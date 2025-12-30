import { describe, it, expect, vi } from 'vitest';

// Mock prettier-plugin-apex before any imports
vi.mock('prettier-plugin-apex', () => ({
	default: {
		printers: undefined,
		languages: [],
		parsers: {},
		options: {},
		defaultOptions: {},
	},
	printers: undefined,
	languages: [],
	parsers: {},
	options: {},
	defaultOptions: {},
}));

describe('index error handling', () => {
	it('should throw error when prettier-plugin-apex printer is missing', async () => {
		// Reset modules to ensure fresh import
		vi.resetModules();

		// Try to import the module - it should throw an error at module load time
		await expect(async () => {
			await import('../src/index.js');
		}).rejects.toThrow(
			'prettier-plugin-apex-imo requires prettier-plugin-apex to be installed',
		);
	});
});
