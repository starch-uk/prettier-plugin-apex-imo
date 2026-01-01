/**
 * @file Configuration for Vitest test runner.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			exclude: ['src/types.ts'],
			include: ['src/**/*.ts'],
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			thresholds: {
				branches: 100,
				functions: 100,
				lines: 100,
				statements: 100,
			},
		},
		globals: true,
	},
});
