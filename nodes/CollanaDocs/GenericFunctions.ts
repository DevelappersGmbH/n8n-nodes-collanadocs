import type { IExecuteFunctions, IHttpRequestMethods, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { randomBytes } from 'crypto';

export const CREDENTIALS_NAME = 'collanaDocsApi';

export interface IMultipartField {
	name: string;
	value: string;
}

export interface IBinaryResponse {
	body: Buffer;
	contentType: string;
	fileName?: string;
}

/**
 * Builds a multipart/form-data body by hand. Community nodes must ship without
 * runtime dependencies, so this replaces the usual form-data package.
 */
export function buildMultipartBody(fields: IMultipartField[]): {
	body: Buffer;
	contentType: string;
} {
	const boundary = `----n8nCollanaDocs${randomBytes(16).toString('hex')}`;
	const chunks: Buffer[] = [];

	for (const field of fields) {
		const header =
			`--${boundary}\r\nContent-Disposition: form-data; name="${quote(field.name)}"\r\n\r\n`;

		chunks.push(Buffer.from(header, 'utf8'));
		chunks.push(Buffer.from(field.value, 'utf8'));
		chunks.push(Buffer.from('\r\n', 'utf8'));
	}

	chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));

	return {
		body: Buffer.concat(chunks),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

/** Keeps a quote or newline in a field name from breaking out of the header. */
function quote(value: string): string {
	return value.replace(/[\r\n"]/g, '');
}

/**
 * Sends a multipart request to the Collana Docs service and returns the raw
 * response body, which is a PDF or an XML document rather than JSON.
 */
export async function collanaDocsBinaryRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	fields: IMultipartField[],
): Promise<IBinaryResponse> {
	const credentials = await this.getCredentials(CREDENTIALS_NAME);
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

	// The credential has no default base URL, so an unfilled one would otherwise
	// turn into a relative request and fail with an unhelpful message.
	if (baseUrl === '') {
		throw new NodeOperationError(
			this.getNode(),
			'The Collana Docs credential has no Base URL',
			{ description: 'Set the Base URL of your Collana Docs instance on the credential.' },
		);
	}

	const { body, contentType } = buildMultipartBody(fields);

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			CREDENTIALS_NAME,
			{
				method,
				url: `${baseUrl}${endpoint}`,
				body,
				headers: {
					'Content-Type': contentType,
					'Content-Length': String(body.length),
				},
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

/**
 * Pulls the file name out of a Content-Disposition header. RFC 6266 says the
 * extended `filename*` form wins over plain `filename`; RFC 5987 gives it the
 * shape `charset'language'percent-encoded`, where the language part is
 * optional but its quotes are not.
 */
export function parseContentDisposition(header: string | undefined): string | undefined {
	if (!header) return undefined;

	const extended =
		/filename\*\s*=\s*"?([A-Za-z0-9!#$%&+\-^_`{}~.]+)'([^']*)'([^";,]+)"?/i.exec(header);

	if (extended) {
		const [, charset, , value] = extended;
		return decodeExtended(value, charset);
	}

	return /filename\s*=\s*"?([^";]+)"?/i.exec(header)?.[1];
}

/** Percent-decodes an RFC 5987 value in the charset the header declares. */
function decodeExtended(value: string, charset: string): string {
	const bytes: number[] = [];

	for (let i = 0; i < value.length; i++) {
		if (value[i] === '%' && /^[0-9a-f]{2}$/i.test(value.slice(i + 1, i + 3))) {
			bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
			i += 2;
		} else {
			bytes.push(value.charCodeAt(i) & 0xff);
		}
	}

	const buffer = Buffer.from(bytes);

	return charset.toLowerCase() === 'iso-8859-1'
		? buffer.toString('latin1')
		: buffer.toString('utf8');
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
