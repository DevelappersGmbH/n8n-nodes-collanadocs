import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import FormData from 'form-data';

import { documentFields, documentOperations } from './DocumentDescription';
import { collanaDocsBinaryRequest } from './GenericFunctions';

interface IMarginValues {
	top?: string;
	right?: string;
	bottom?: string;
	left?: string;
}

interface IGenerateOptions {
	fileName?: string;
	imageBinaryProperty?: string;
	outputBinaryProperty?: string;
}

const ENDPOINTS: Record<string, string> = {
	generate: '/v1/generate',
	generateOffer: '/v1/generate/offer',
};

export class CollanaDocs implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Collana Docs',
		name: 'collanaDocs',
		icon: 'file:collanaDocs.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["outputFormat"] }}',
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
			},
		],
		properties: [...documentOperations, ...documentFields],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const endpoint = ENDPOINTS[operation];
				if (endpoint === undefined) {
					throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
						itemIndex: i,
					});
				}

				const outputFormat = this.getNodeParameter('outputFormat', i) as string;
				const documentData = this.getNodeParameter('documentData', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IGenerateOptions;

				const form = new FormData();
				form.append('outputFormat', outputFormat);
				form.append('documentData', documentData);

				if (outputFormat !== 'XRechnung') {
					appendIfSet(form, 'headerTemplate', this.getNodeParameter('headerTemplate', i, '') as string);
					appendIfSet(form, 'bodyTemplate', this.getNodeParameter('bodyTemplate', i, '') as string);
					appendIfSet(form, 'footerTemplate', this.getNodeParameter('footerTemplate', i, '') as string);
					appendIfSet(form, 'styleSheet', this.getNodeParameter('styleSheet', i, '') as string);

					const localizationData = this.getNodeParameter('localizationData', i, []) as string[];
					for (const localization of localizationData) {
						appendIfSet(form, 'localizationData', localization);
					}

					const margins = this.getNodeParameter('margins.values', i, {}) as IMarginValues;
					for (const side of ['top', 'right', 'bottom', 'left'] as const) {
						appendIfSet(form, `margins.${side}`, margins[side]);
					}

					if (options.imageBinaryProperty) {
						const binary = this.helpers.assertBinaryData(i, options.imageBinaryProperty);
						const buffer = await this.helpers.getBinaryDataBuffer(
							i,
							options.imageBinaryProperty,
						);
						form.append('image', buffer, {
							filename: binary.fileName ?? 'image',
							contentType: binary.mimeType,
						});
					}
				}

				const response = await collanaDocsBinaryRequest.call(this, 'POST', endpoint, form);

				const fileName =
					options.fileName || response.fileName || defaultFileName(outputFormat);
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
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

function appendIfSet(form: FormData, field: string, value: string | undefined): void {
	if (value !== undefined && value !== '') {
		form.append(field, value);
	}
}

function defaultFileName(outputFormat: string): string {
	return outputFormat === 'XRechnung' ? 'document.xml' : 'document.pdf';
}
