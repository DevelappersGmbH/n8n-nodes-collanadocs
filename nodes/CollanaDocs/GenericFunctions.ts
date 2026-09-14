import type { IExecuteFunctions, IHttpRequestMethods, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import FormData from 'form-data';

export const CREDENTIALS_NAME = 'collanaDocsApi';

export interface IBinaryResponse {
	body: Buffer;
	contentType: string;
	fileName?: string;
}

/**
 * Sends a multipart request to the Collana Docs service and returns the raw
 * response body, which is a PDF or an XML document rather than JSON.
 */
export async function collanaDocsBinaryRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	form: FormData,
): Promise<IBinaryResponse> {
	const credentials = await this.getCredentials(CREDENTIALS_NAME);
	const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			CREDENTIALS_NAME,
			{
				method,
				url: `${baseUrl}${endpoint}`,
				body: form,
				headers: form.getHeaders(),
				encoding: 'arraybuffer',
				returnFullResponse: true,
				json: false,
			},
		);

		const headers = (response.headers ?? {}) as Record<string, string | string[]>;

		return {
			body: Buffer.from(response.body as ArrayBuffer),
			contentType: firstHeader(headers['content-type']) ?? 'application/octet-stream',
			fileName: parseContentDisposition(firstHeader(headers['content-disposition'])),
		};
	} catch (error) {
		const message = apiErrorMessage(error);

		throw new NodeApiError(
			this.getNode(),
			error as JsonObject,
			message === undefined ? undefined : { message, description: undefined },
		);
	}
}

function firstHeader(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

/** Pulls the file name out of a Content-Disposition header, RFC 5987 form included. */
function parseContentDisposition(header: string | undefined): string | undefined {
	if (!header) return undefined;

	const encoded = /filename\*=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
	if (encoded?.[1]) {
		try {
			return decodeURIComponent(encoded[1]);
		} catch {
			return encoded[1];
		}
	}

	return /filename="?([^";]+)"?/i.exec(header)?.[1];
}

/**
 * The service explains rejections in the response body, but that body arrives
 * as a buffer because the request asks for arraybuffer encoding — without
 * decoding it the user only ever sees n8n's generic status-code message.
 */
function apiErrorMessage(error: unknown): string | undefined {
	const candidate = error as {
		response?: { data?: unknown; body?: unknown };
		cause?: { response?: { data?: unknown; body?: unknown } };
		error?: unknown;
	};

	const body =
		candidate?.response?.data ??
		candidate?.response?.body ??
		candidate?.cause?.response?.data ??
		candidate?.cause?.response?.body ??
		candidate?.error;

	const text = toText(body);
	if (text === undefined) return undefined;

	let parsed: unknown = text;
	try {
		parsed = JSON.parse(text);
	} catch {
		// Not JSON — the plain text is the best we have.
	}

	if (typeof parsed === 'string') return parsed.trim() || undefined;

	const asObject = parsed as { message?: unknown; title?: unknown; detail?: unknown };
	for (const field of [asObject?.detail, asObject?.message, asObject?.title]) {
		if (typeof field === 'string' && field.trim() !== '') return field;
	}

	return undefined;
}

function toText(body: unknown): string | undefined {
	if (Buffer.isBuffer(body)) return body.toString('utf8');
	if (body instanceof ArrayBuffer) return Buffer.from(body).toString('utf8');
	if (typeof body === 'string') return body;
	return undefined;
}
