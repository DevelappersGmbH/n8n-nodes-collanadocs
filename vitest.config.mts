import { createRequire } from 'node:module';

import { defineConfig } from 'vitest/config';

/**
 * n8n-workflow's ESM build ships sourcemaps that reference sources it does not
 * publish, and Vite warns once per file — around forty lines that would bury a
 * real failure. Pointing at the CommonJS build and letting Node load it
 * directly avoids the sourcemap pass entirely, and matches production: the node
 * itself is compiled to CommonJS, so this is the build n8n loads at runtime.
 */
const n8nWorkflowCjs = createRequire(import.meta.url).resolve('n8n-workflow');

export default defineConfig({
	resolve: {
		alias: { 'n8n-workflow': n8nWorkflowCjs },
	},
	test: {
		include: ['test/**/*.test.ts'],
		server: {
			deps: { external: [n8nWorkflowCjs] },
		},
	},
});
