/**
 * @file Configuration for tsup build tool.
 */

import { defineConfig } from 'tsup';

export default defineConfig({
	clean: true,
	dts: true,
	entry: ['src/index.ts'],
	external: ['prettier', 'prettier-plugin-apex'],
	format: ['esm', 'cjs'],
	minify: false,
	sourcemap: true,
	target: 'node20',
});
