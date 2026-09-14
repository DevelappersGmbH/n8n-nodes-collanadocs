import type { INodeProperties } from 'n8n-workflow';

const pdfOnly = {
	show: {
		outputFormat: ['NurPdf', 'PdfMitZugferd'],
	},
};

export const documentFields: INodeProperties[] = [
	{
		displayName: 'Output Format',
		name: 'outputFormat',
		type: 'options',
		options: [
			{
				name: 'PDF Only',
				value: 'NurPdf',
				description: 'Plain PDF rendered from the templates',
			},
			{
				name: 'PDF With ZUGFeRD',
				value: 'PdfMitZugferd',
				description: 'PDF/A-3 with an embedded ZUGFeRD 2.3 invoice XML',
			},
			{
				name: 'XRechnung (XML)',
				value: 'XRechnung',
				description: 'XRechnung 3.x XML only, no PDF rendering',
			},
		],
		default: 'NurPdf',
		description: 'Which artifact the service should return',
	},
	{
		displayName: 'Document Data',
		name: 'documentData',
		type: 'string',
		typeOptions: { rows: 6 },
		default: '',
		required: true,
		placeholder: '{ "schema_version": 1, "document": { "number": "AN-2026-0042" }, ... }',
		hint: 'JSON needs schema_version 1 and a document object; numbers are sent as strings',
		description:
			'The document payload as JSON or Business Central XML, reachable in the templates as d.*. JSON is validated against the service schema: it requires schema_version 1 and a document object at the root, and every numeric value (position, tax_rate, amounts) must be a string.',
	},
	{
		displayName: 'Body Template',
		name: 'bodyTemplate',
		type: 'string',
		typeOptions: { rows: 12 },
		default: '',
		displayOptions: pdfOnly,
		description: 'Scriban/HTML template for the page body',
	},
	{
		displayName: 'Header Template',
		name: 'headerTemplate',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: pdfOnly,
		description: 'Scriban/HTML template rendered into the page header on every page',
	},
	{
		displayName: 'Footer Template',
		name: 'footerTemplate',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: pdfOnly,
		description: 'Scriban/HTML template rendered into the page footer on every page',
	},
	{
		displayName: 'Style Sheet',
		name: 'styleSheet',
		type: 'string',
		typeOptions: { rows: 8 },
		default: '',
		displayOptions: pdfOnly,
		description: 'CSS applied to header, body and footer',
	},
	{
		displayName: 'Localization Data',
		name: 'localizationData',
		type: 'string',
		typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Localization' },
		default: [],
		required: true,
		displayOptions: pdfOnly,
		hint: 'At least one entry is required for PDF output',
		description:
			'Localization documents (JSON) reachable in the templates as t.*. The service rejects PDF requests that carry none.',
	},
	{
		displayName: 'Margins',
		name: 'margins',
		type: 'fixedCollection',
		default: {},
		displayOptions: pdfOnly,
		placeholder: 'Add Margins',
		description: 'Page margins, e.g. "20mm". Omitted values fall back to the service defaults.',
		options: [
			{
				name: 'values',
				displayName: 'Margins',
				values: [
					{
						displayName: 'Top',
						name: 'top',
						type: 'string',
						default: '',
						placeholder: '20mm',
						description: 'Top margin, including its unit',
					},
					{
						displayName: 'Right',
						name: 'right',
						type: 'string',
						default: '',
						placeholder: '15mm',
						description: 'Right margin, including its unit',
					},
					{
						displayName: 'Bottom',
						name: 'bottom',
						type: 'string',
						default: '',
						placeholder: '20mm',
						description: 'Bottom margin, including its unit',
					},
					{
						displayName: 'Left',
						name: 'left',
						type: 'string',
						default: '',
						placeholder: '15mm',
						description: 'Left margin, including its unit',
					},
				],
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				placeholder: 'invoice.pdf',
				description:
					'Name for the returned file. Defaults to the name sent by the service, or "document" with a matching extension.',
			},
			{
				displayName: 'Image Input Binary Field',
				name: 'imageBinaryProperty',
				type: 'string',
				default: '',
				placeholder: 'logo',
				hint: 'Name of the input binary field holding the image',
				description:
					'Binary field of the incoming item whose image is uploaded with the request, e.g. a logo referenced by the templates',
			},
			{
				displayName: 'Put Output File in Field',
				name: 'outputBinaryProperty',
				type: 'string',
				default: 'data',
				hint: 'The name of the output binary field to put the file in',
				description: 'Binary field of the outgoing item that receives the generated document',
			},
		],
	},
];
