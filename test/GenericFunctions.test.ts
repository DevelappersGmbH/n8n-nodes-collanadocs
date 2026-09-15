import { describe, expect, it } from 'vitest';

import { buildMultipartBody, parseContentDisposition } from '../nodes/CollanaDocs/GenericFunctions';

/**
 * The service names the rendered file in a Content-Disposition header. Getting
 * this wrong is silent: the download still works, it just carries a mangled
 * name, so the cases below are the ones a review would not catch by reading.
 */
describe('parseContentDisposition', () => {
	it('reads a quoted filename', () => {
		expect(parseContentDisposition('attachment; filename="invoice.pdf"')).toBe('invoice.pdf');
	});

	it('reads an unquoted filename and stops at the next parameter', () => {
		expect(parseContentDisposition('attachment; filename=invoice.pdf; size=42')).toBe(
			'invoice.pdf',
		);
	});

	it('matches case-insensitively, as HTTP parameter names are', () => {
		expect(parseContentDisposition('Attachment; FileName="invoice.pdf"')).toBe('invoice.pdf');
	});

	it('percent-decodes a UTF-8 filename* value', () => {
		expect(
			parseContentDisposition("attachment; filename*=UTF-8''Rechnung%20M%C3%BCller.pdf"),
		).toBe('Rechnung Müller.pdf');
	});

	it('decodes a filename* value in the charset it declares, not always UTF-8', () => {
		// %FC is ü in ISO-8859-1 but an invalid UTF-8 sequence, so a decoder that
		// ignores the charset produces a replacement character here.
		expect(
			parseContentDisposition("attachment; filename*=iso-8859-1'de'Rechnung%20M%FCller.pdf"),
		).toBe('Rechnung Müller.pdf');
	});

	it('accepts a filename* value whose language part is empty', () => {
		expect(parseContentDisposition("attachment; filename*=UTF-8''report.pdf")).toBe('report.pdf');
	});

	// RFC 6266 §4.3: a recipient that understands filename* must prefer it.
	it('prefers filename* over a plain filename, whichever comes first', () => {
		const extendedLast =
			'attachment; filename="Rechnung Muller.pdf"; filename*=UTF-8\'\'Rechnung%20M%C3%BCller.pdf';
		const extendedFirst =
			'attachment; filename*=UTF-8\'\'Rechnung%20M%C3%BCller.pdf; filename="Rechnung Muller.pdf"';

		expect(parseContentDisposition(extendedLast)).toBe('Rechnung Müller.pdf');
		expect(parseContentDisposition(extendedFirst)).toBe('Rechnung Müller.pdf');
	});

	it('returns undefined when the header carries no filename at all', () => {
		expect(parseContentDisposition('attachment')).toBeUndefined();
		expect(parseContentDisposition('inline')).toBeUndefined();
	});

	it('returns undefined for a missing or empty header', () => {
		expect(parseContentDisposition(undefined)).toBeUndefined();
		expect(parseContentDisposition('')).toBeUndefined();
	});
});

/** The boundary that buildMultipartBody generated, read back off the body. */
function boundaryOf(contentType: string): string {
	const match = /boundary=(.+)$/.exec(contentType);
	if (match === null) throw new Error(`no boundary in ${contentType}`);
	return match[1];
}

/**
 * This replaces the form-data package, which a community node may not ship, so
 * the wire format is ours to get right — and a malformed body comes back from
 * the service as an opaque 400.
 */
describe('buildMultipartBody', () => {
	it('frames a field exactly as multipart/form-data requires', () => {
		const { body, contentType } = buildMultipartBody([{ name: 'outputFormat', value: 'NurPdf' }]);
		const boundary = boundaryOf(contentType);

		expect(body.toString('utf8')).toBe(
			`--${boundary}\r\n` +
				'Content-Disposition: form-data; name="outputFormat"\r\n\r\n' +
				'NurPdf\r\n' +
				`--${boundary}--\r\n`,
		);
	});

	it('announces the same boundary in the Content-Type header as it writes', () => {
		const { body, contentType } = buildMultipartBody([{ name: 'a', value: '1' }]);

		expect(contentType).toMatch(/^multipart\/form-data; boundary=----n8nCollanaDocs[0-9a-f]{32}$/);
		expect(body.toString('utf8')).toContain(`--${boundaryOf(contentType)}\r\n`);
	});

	it('keeps the fields in the order they were given', () => {
		const { body } = buildMultipartBody([
			{ name: 'first', value: '1' },
			{ name: 'second', value: '2' },
			{ name: 'third', value: '3' },
		]);
		const text = body.toString('utf8');

		expect(text.indexOf('name="first"')).toBeLessThan(text.indexOf('name="second"'));
		expect(text.indexOf('name="second"')).toBeLessThan(text.indexOf('name="third"'));
	});

	it('draws a fresh boundary per call, so one body cannot be replayed into another', () => {
		const first = buildMultipartBody([{ name: 'a', value: '1' }]);
		const second = buildMultipartBody([{ name: 'a', value: '1' }]);

		expect(first.contentType).not.toBe(second.contentType);
	});

	/**
	 * The request sends Content-Length: body.length. If a value were measured in
	 * UTF-16 code units rather than bytes the service would read a truncated
	 * body, so the returned Buffer has to be byte-accurate.
	 */
	it('measures a non-ASCII value in bytes, not characters', () => {
		const value = 'Grüße aus München';
		const { body } = buildMultipartBody([{ name: 'text', value }]);

		expect(body.toString('utf8')).toContain(value);
		expect(body.length).toBeGreaterThan(Buffer.byteLength(value) - 1);
		expect(body.includes(Buffer.from(value, 'utf8'))).toBe(true);
	});

	it('carries a value containing CRLF through untouched, as only names are sanitised', () => {
		const { body } = buildMultipartBody([{ name: 'bodyTemplate', value: '<p>a</p>\r\n<p>b</p>' }]);

		expect(body.toString('utf8')).toContain('<p>a</p>\r\n<p>b</p>\r\n--');
	});

	/**
	 * A field name reaches the header unescaped, so a quote or newline in one
	 * would otherwise let a caller forge headers or an extra part.
	 */
	it('strips quotes and newlines from a field name', () => {
		const { body } = buildMultipartBody([
			{ name: 'evil"\r\nContent-Type: text/html\r\n\r\ninjected', value: 'v' },
		]);
		const text = body.toString('utf8');

		expect(text).toContain('name="evilContent-Type: text/htmlinjected"');
		expect(text).not.toContain('text/html\r\n');
	});

	it('produces a body that is just the closing boundary when there are no fields', () => {
		const { body, contentType } = buildMultipartBody([]);

		expect(body.toString('utf8')).toBe(`--${boundaryOf(contentType)}--\r\n`);
	});
});
