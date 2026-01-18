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
		env: {
			// Suppress deprecation warning from prettier-plugin-apex dependency
			// DEP0190: prettier-plugin-apex uses child_process.spawn with shell:true
			NODE_OPTIONS: '--no-deprecation',
		},
		globals: true,
		// Reset mocks before each test to ensure fresh state
		mockReset: true,
		// Performance optimization: use threads pool for faster execution
		pool: 'threads',
		// Enable concurrent test execution by default
		sequence: {
			concurrent: true,
		},
	},
});
