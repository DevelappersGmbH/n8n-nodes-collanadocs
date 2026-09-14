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
		throw new NodeApiError(this.getNode(), readableError(error) as JsonObject);
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
 * Error bodies arrive as buffers because the request asks for arraybuffer
 * encoding, so decode them before they reach the user.
 */
function readableError(error: unknown): unknown {
	const candidate = error as { response?: { body?: unknown }; error?: unknown };
	const body = candidate?.response?.body ?? candidate?.error;

	if (!Buffer.isBuffer(body)) return error;

	const text = body.toString('utf8');
	let decoded: unknown = text;
	try {
		decoded = JSON.parse(text);
	} catch {
		// Not JSON — the plain text is the best we have.
	}

	if (candidate.response) candidate.response.body = decoded;
	candidate.error = decoded;

	return error;
}
