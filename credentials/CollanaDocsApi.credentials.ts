import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

const TEST_BOUNDARY = '----n8nCollanaDocsCredentialTest';

/** An HTML shell with nothing in it, so the renderer has a valid but empty page. */
const EMPTY_TEMPLATE = '<html><body></body></html>';

/**
 * The smallest document the service accepts: every field the renderer asks for,
 * each one deliberately empty, which comes out as a single blank page. Assembled
 * by hand because the endpoint takes multipart/form-data and community nodes
 * ship without runtime dependencies.
 */
const TEST_BODY =
	(
		[
			['outputFormat', 'NurPdf'],
			['documentData', JSON.stringify({ schema_version: 1, document: {} })],
			['headerTemplate', EMPTY_TEMPLATE],
			['bodyTemplate', EMPTY_TEMPLATE],
			['footerTemplate', EMPTY_TEMPLATE],
			['styleSheet', 'body {}'],
			// A PDF request carrying no localization is rejected before rendering.
			['localizationData', '{}'],
		] as const
	)
		.map(
			([name, value]) =>
				`--${TEST_BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
		)
		.join('') + `--${TEST_BOUNDARY}--\r\n`;

export class CollanaDocsApi implements ICredentialType {
	name = 'collanaDocsApi';

	displayName = 'Collana Docs API';

	icon = { light: 'file:collanaDocs.svg', dark: 'file:collanaDocs.dark.svg' } as const;

	documentationUrl = 'https://github.com/DevelappersGmbH/n8n-nodes-collanadocs#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://pdfgen.example.com',
			required: true,
			description: 'Root URL of the Collana Docs service, without a trailing slash',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Shared client secret, sent as the X-Client-Secret header. Required for all /v1/generate endpoints.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-Client-Secret': '={{ $credentials.clientSecret }}',
			},
		},
	};

	/**
	 * A declarative test can only read a 2xx as success — `rules` turn responses
	 * into errors, never the other way round — so the test has to render the
	 * blank page above rather than provoke a validation error. Templates that
	 * read no data keep the render from failing on a field the payload omits.
	 *
	 * Verified against the service: a valid secret answers 200 with a one-page
	 * PDF, a wrong secret gives 401, and a wrong path gives 404.
	 */
	test: ICredentialTestRequest = {
		request: {
			method: 'POST',
			// A trailing slash is trimmed when baseURL and url are joined.
			baseURL: '={{ $credentials.baseUrl }}',
			url: '/v1/generate',
			headers: {
				'Content-Type': `multipart/form-data; boundary=${TEST_BOUNDARY}`,
			},
			body: TEST_BODY,
			// The response is a PDF, so it must not be run through a JSON parser.
			encoding: 'arraybuffer',
		},
	};
}
