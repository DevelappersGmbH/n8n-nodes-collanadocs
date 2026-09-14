import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import FormData from 'form-data';

import { documentFields } from './DocumentDescription';
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

const ENDPOINT = '/v1/generate';

export class CollanaDocs implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Collana Docs',
		name: 'collanaDocs',
		icon: 'file:collanaDocs.svg',
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
			},
		],
		properties: documentFields,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
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

					// The service rejects a PDF request that carries no localization, and
					// blank entries never reach it, so catch that here rather than
					// spending a round trip on it.
					const localizationData = (
						this.getNodeParameter('localizationData', i, []) as string[]
					).filter((entry) => entry !== undefined && entry !== '');

					if (localizationData.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'Localization Data is required when the output format is a PDF',
							{
								itemIndex: i,
								description:
									'Add at least one localization document. It is reachable in the templates as t.*.',
							},
						);
					}

					for (const localization of localizationData) {
						form.append('localizationData', localization);
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

				const response = await collanaDocsBinaryRequest.call(this, 'POST', ENDPOINT, form);

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
