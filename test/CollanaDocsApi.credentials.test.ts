import { describe, expect, it } from 'vitest';

import { CollanaDocsApi } from '../credentials/CollanaDocsApi.credentials';

const credential = new CollanaDocsApi();

const propertyByName = (name: string) => credential.properties.find((p) => p.name === name);

/**
 * Credential field names are part of the package's public surface: renaming one
 * silently empties that field in every credential users have already saved.
 * These assertions are here to make such a rename a deliberate, breaking act.
 */
describe('CollanaDocsApi credential shape', () => {
	it('keeps the credential name workflows refer to', () => {
		expect(credential.name).toBe('collanaDocsApi');
	});

	it('exposes exactly the two documented fields', () => {
		expect(credential.properties.map((p) => p.name)).toEqual(['baseUrl', 'clientSecret']);
	});

	it('defaults the base URL to the hosted instance', () => {
		expect(propertyByName('baseUrl')?.default).toBe('https://collanadocs.develappers.de');
	});

	it('keeps the client secret masked in the UI', () => {
		expect(propertyByName('clientSecret')?.typeOptions?.password).toBe(true);
		expect(propertyByName('clientSecret')?.default).toBe('');
	});

	it('sends the secret as the X-Client-Secret header', () => {
		expect(credential.authenticate.properties.headers).toEqual({
			'X-Client-Secret': '={{ $credentials.clientSecret }}',
		});
	});
});

/**
 * Verified against the live service: GET /v1/auth/check answers 200
 * {"authenticated":true} for a valid secret and 401 for a wrong or missing one.
 * POST on that path is 405, so the method matters.
 */
describe('CollanaDocsApi credential test request', () => {
	it('checks the secret against /v1/auth/check instead of rendering a document', () => {
		expect(credential.test.request.method).toBe('GET');
		expect(credential.test.request.url).toBe('/v1/auth/check');
		expect(credential.test.request.baseURL).toBe('={{ $credentials.baseUrl }}');
	});

	it('sends no body, so the check cannot be rejected for its payload', () => {
		expect(credential.test.request.body).toBeUndefined();
	});

	/**
	 * A declarative test reads any 2xx as success on its own, so a failed check
	 * reported in a 200 body would pass without this rule.
	 */
	it('fails the test when the service reports authenticated: false', () => {
		expect(credential.test.rules).toEqual([
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'authenticated',
					value: false,
					message: expect.any(String),
				},
			},
		]);
	});
});
