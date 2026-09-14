// tsc only emits JavaScript, so the node icons have to be copied into dist/
// separately — n8n loads them from next to the compiled node.
const { cpSync, existsSync } = require('fs');
const { join } = require('path');

const isIcon = (source) => /\.(png|svg)$/i.test(source);

for (const dir of ['nodes', 'credentials']) {
	if (!existsSync(dir)) continue;
	cpSync(dir, join('dist', dir), { recursive: true, filter: (src) => !src.includes('.') || isIcon(src) });
}
