import type {
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	IExecuteFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { documentFields } from './DocumentDescription';
import { collanaDocsBinaryRequest } from './GenericFunctions';
import type { IMultipartField } from './GenericFunctions';

interface IMarginValues {
	top?: string;
	right?: string;
	bottom?: string;
	left?: string;
}

interface IGenerateOptions {
	fileName?: string;
	outputBinaryProperty?: string;
}

const ENDPOINT = '/v1/generate';

export class CollanaDocs implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Collana Docs',
		name: 'collanaDocs',
		icon: { light: 'file:collanaDocs.svg', dark: 'file:collanaDocs.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["outputFormat"] }}',
		description: 'Generate PDF, ZUGFeRD and XRechnung documents with the Collana Docs service',
		defaults: {
			name: 'Collana Docs',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'collanaDocsApi',
				required: true,
				testedBy: 'collanaDocsApiTest',
			},
		],
		properties: documentFields,
	};

	methods = {
		credentialTest: {
			/**
			 * No endpoint answers 2xx on the client secret alone, so the test posts a
			 * well-formed but deliberately incomplete generate request and reads the
			 * rejection. Against the real service that is always a 400 — the payload
			 * parsed and failed validation — while a wrong secret gives 401 and an
			 * unrelated host gives 404, 405 or a 2xx. Only the 400 is treated as
			 * proof that a Collana Docs API answered.
			 */
			async collanaDocsApiTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const credentials = credential.data ?? {};
				const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

				if (baseUrl === '') {
					return { status: 'Error', message: 'Base URL is empty' };
				}

				const wrongService = {
					status: 'Error' as const,
					message: `${baseUrl} did not answer like a Collana Docs service — check the Base URL`,
				};

				try {
					// ICredentialTestFunctions exposes `request` and nothing else — there
					// is no httpRequest on this interface to migrate to.
					// eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions
					await this.helpers.request({
						method: 'POST',
						uri: `${baseUrl}${ENDPOINT}`,
						headers: { 'X-Client-Secret': String(credentials.clientSecret ?? '') },
						formData: { outputFormat: 'NurPdf', documentData: '{}' },
					});
				} catch (error) {
					const statusCode = (error as { statusCode?: number }).statusCode;

					if (statusCode === 401 || statusCode === 403) {
						return { status: 'Error', message: 'The client secret was refused' };
					}

					if (statusCode === 400) {
						return { status: 'OK', message: 'Connection established' };
					}

					if (statusCode === undefined) {
						return {
							status: 'Error',
							message: `Could not reach ${baseUrl}: ${(error as Error).message}`,
						};
					}

					return { ...wrongService, message: `${wrongService.message} (HTTP ${statusCode})` };
				}

				// An incomplete payload must never be accepted, so a 2xx means this is
				// not the endpoint we are looking for.
				return wrongService;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const outputFormat = this.getNodeParameter('outputFormat', i) as string;
				const documentData = this.getNodeParameter('documentData', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IGenerateOptions;

				const fields: IMultipartField[] = [
					{ name: 'outputFormat', value: outputFormat },
					{ name: 'documentData', value: documentData },
				];

				if (outputFormat !== 'XRechnung') {
					appendIfSet(fields, 'headerTemplate', this.getNodeParameter('headerTemplate', i, '') as string);
					appendIfSet(fields, 'bodyTemplate', this.getNodeParameter('bodyTemplate', i, '') as string);
					appendIfSet(fields, 'footerTemplate', this.getNodeParameter('footerTemplate', i, '') as string);
					appendIfSet(fields, 'styleSheet', this.getNodeParameter('styleSheet', i, '') as string);

					// The service rejects a PDF request that carries no localization, so
					// catch that here rather than spending a round trip on it.
					const localizationData = this.getNodeParameter('localizationData', i, '') as string;

					if (localizationData.trim() === '') {
						throw new NodeOperationError(
							this.getNode(),
							'Localization Data is required when the output format is a PDF',
							{
								itemIndex: i,
								description:
									'Pass the localization document for the language you want. It is reachable in the templates as t.*.',
							},
						);
					}

					fields.push({ name: 'localizationData', value: localizationData });

					const margins = this.getNodeParameter('margins.values', i, {}) as IMarginValues;
					for (const side of ['top', 'right', 'bottom', 'left'] as const) {
						appendIfSet(fields, `margins.${side}`, margins[side]);
					}
				}

				const response = await collanaDocsBinaryRequest.call(this, 'POST', ENDPOINT, fields);

				const fileName = options.fileName || response.fileName || defaultFileName(outputFormat);
				const outputBinaryProperty = options.outputBinaryProperty || 'data';

				returnData.push({
					json: {
						fileName,
						mimeType: response.contentType,
						fileSize: response.body.length,
						outputFormat,
					},
					binary: {
						[outputBinaryProperty]: await this.helpers.prepareBinaryData(
							response.body,
							fileName,
							response.contentType.split(';')[0],
						),
					},
					pairedItem: { item: i },
				});
			} catch (error) {
				// Errors from the request helper already carry the service's own
				// message; anything else gets wrapped so the workflow never sees a
				// raw throw.
				const failure =
					error instanceof NodeApiError || error instanceof NodeOperationError
						? error
						: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });

				if (this.continueOnFail()) {
					returnData.push({
						json: { error: failure.message },
						pairedItem: { item: i },
					});
					continue;
				}

				throw failure;
			}
		}

		return [returnData];
	}
}

function appendIfSet(fields: IMultipartField[], name: string, value: string | undefined): void {
	if (value !== undefined && value !== '') {
		fields.push({ name, value });
	}
}

function defaultFileName(outputFormat: string): string {
	return outputFormat === 'XRechnung' ? 'document.xml' : 'document.pdf';
}
