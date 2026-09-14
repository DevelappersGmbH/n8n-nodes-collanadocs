// tsc only emits JavaScript, so the non-TypeScript files a node needs at
// runtime have to be copied into dist/ separately — n8n loads both the icon
// and the codex metadata from next to the compiled node.
const { cpSync, existsSync } = require('fs');
const { join } = require('path');

const isAsset = (source) => /\.(png|svg|node\.json)$/i.test(source);

for (const dir of ['nodes', 'credentials']) {
	if (!existsSync(dir)) continue;
	cpSync(dir, join('dist', dir), {
		recursive: true,
		filter: (src) => !src.includes('.') || isAsset(src),
	});
}
