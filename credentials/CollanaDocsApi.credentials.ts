import type {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CollanaDocsApi implements ICredentialType {
	name = 'collanaDocsApi';

	displayName = 'Collana Docs API';

	icon = { light: 'file:collanaDocs.svg', dark: 'file:collanaDocs.dark.svg' } as const;

	documentationUrl = 'https://pdfgen.develappers-staging.de/swagger';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://pdfgen.develappers-staging.de',
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
}
