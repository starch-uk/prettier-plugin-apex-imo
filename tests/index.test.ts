/**
 * @file Tests for the main plugin entry point.
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-magic-numbers -- Test file needs type assertions and magic numbers for testing edge cases */
import { describe, it, expect, vi } from 'vitest';
import plugin, {
	languages,
	parsers,
	printers,
	options,
	defaultOptions,
	isApexParser,
} from '../src/index.js';
import { loadFixture } from './test-utils.js';

describe('index', () => {
	describe('plugin structure', () => {
		it.concurrent('exports plugin object with correct type', () => {
			expect(plugin).toBeDefined();
			expect(typeof plugin).toBe('object');
		});

		it.concurrent.each([
			['languages', languages],
			['parsers', parsers],
			['printers', printers],
			['options', options],
			['defaultOptions', defaultOptions],
		])(
			'exports %s property that matches plugin.%s',
			(propName: string, namedExport: unknown) => {
				const pluginProp = plugin[propName as keyof typeof plugin];
				expect(pluginProp).toBeDefined();
				expect(namedExport).toBeDefined();
				expect(pluginProp).toBe(namedExport);
			},
		);

		it.concurrent('exports apex printer with print method', () => {
			expect(plugin.printers?.apex).toBeDefined();
			expect(typeof plugin.printers?.apex?.print).toBe('function');
		});
	});

	describe('error handling', () => {
		it('should throw error when prettier-plugin-apex printer is missing', async () => {
			// Mock prettier-plugin-apex at runtime (doMock works after imports)
			vi.doMock('prettier-plugin-apex', () => ({
				default: {
					defaultOptions: {},
					languages: [],
					options: {},
					parsers: {},
					printers: undefined,
				},
				defaultOptions: {},
				languages: [],
				options: {},
				parsers: {},
				printers: undefined,
			}));

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

	describe('isApexParser', () => {
		it.concurrent.each([
			{
				description: 'should return true for apex parser',
				expected: true,
				parser: 'apex',
			},
			{
				description: 'should return true for apex-anonymous parser',
				expected: true,
				parser: 'apex-anonymous',
			},
			{
				description: 'should return false for non-apex parser',
				expected: false,
				parser: 'typescript',
			},
			{
				description: 'should return false for undefined parser',
				expected: false,
				parser: undefined,
			},
			{
				description: 'should return false for non-string parser',
				expected: false,
				parser: 123 as unknown as string,
			},
		])(
			'$description',
			({
				expected,
				parser,
			}: Readonly<{
				description: string;
				expected: boolean;
				parser: string | undefined;
			}>) => {
				expect(isApexParser(parser)).toBe(expected);
			},
		);
	});
});
