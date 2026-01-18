/**
 * @file Tests for the main plugin entry point.
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- Test file needs type assertions for testing edge cases */
import { describe, it, expect, vi } from 'vitest';
import type { Plugin } from 'prettier';
import type { ApexNode } from '../src/types.js';
import plugin, {
	languages,
	parsers,
	printers,
	options,
	defaultOptions,
	isApexParser,
	wrapParsers,
} from '../src/index.js';
import { createMockPrettierPluginApex } from './prettier-mock.js';

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
			vi.doMock('prettier-plugin-apex', () =>
				createMockPrettierPluginApex({ printers: undefined }),
			);

			vi.resetModules();

			await expect(async () => {
				await import('../src/index.js');
			}).rejects.toThrow(
				'prettier-plugin-apex-imo requires prettier-plugin-apex to be installed',
			);
		});
	});

	describe('wrappedParsers', () => {
		it.concurrent(
			'should skip invalid parsers (missing parse method)',
			() => {
				// Create mock parsers object with invalid entries to test skipping invalid parsers
				const mockParsers = {
					invalid1: undefined, // undefined entry
					invalid2: {}, // missing parse method
					invalid3: {
						parse: 'not a function', // parse is not a function
					},
					valid: {
						// eslint-disable-next-line @typescript-eslint/require-await -- Async signature required for mock compatibility
						parse: async () => ({}),
					},
				} as unknown as Readonly<Plugin<ApexNode>['parsers']>;

				const wrapped = wrapParsers(
					mockParsers,
					{} as Plugin<ApexNode>,
				);

				// Should only wrap valid parsers
				expect(wrapped).toBeDefined();
				expect(wrapped?.valid).toBeDefined();
				expect(
					typeof (wrapped?.valid as { parse?: unknown }).parse,
				).toBe('function');
				// Invalid parsers should be skipped
				expect(wrapped?.invalid1).toBeUndefined();
				expect(wrapped?.invalid2).toBeUndefined();
				expect(wrapped?.invalid3).toBeUndefined();
			},
		);

		it.concurrent('should handle null/undefined parsers', () => {
			// Test with null/undefined parsers
			expect(wrapParsers(null, {} as Plugin<ApexNode>)).toBeNull();
			expect(
				wrapParsers(undefined, {} as Plugin<ApexNode>),
			).toBeUndefined();
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
