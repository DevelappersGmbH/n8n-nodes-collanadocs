import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/** The instance Develappers runs; an own deployment overrides it. */
const DEFAULT_BASE_URL = 'https://collanadocs.develappers.de';

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
			default: DEFAULT_BASE_URL,
			placeholder: DEFAULT_BASE_URL,
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
				'Shared client secret, sent as the X-Client-Secret header. Required for all /v1 endpoints.',
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
	 * `GET /v1/auth/check` exists for exactly this: it answers
	 * `{"authenticated":true}` for a valid secret and 401 for a wrong or missing
	 * one, without rendering anything.
	 *
	 * The rule covers the case where the endpoint reports a failed check in a
	 * 200 body — a declarative test reads any 2xx as success on its own.
	 */
	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			// A trailing slash is trimmed when baseURL and url are joined.
			baseURL: '={{ $credentials.baseUrl }}',
			url: '/v1/auth/check',
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'authenticated',
					value: false,
					message: 'The client secret was rejected by the Collana Docs service',
				},
			},
		],
	};
}
