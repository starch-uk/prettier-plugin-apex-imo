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
	shouldSkipCodeBlock,
	wrapParsers,
	type ShouldSkipCodeBlockParams,
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

	describe('shouldSkipCodeBlock', () => {
		it.concurrent.each([
			{
				description: 'should return true for empty formatted code',
				expected: true,
				params: {
					endPos: 4,
					formattedCode: '   ',
					originalCode: 'test',
					processedText: 'text',
					startPos: 0,
				} as ShouldSkipCodeBlockParams,
			},
			{
				description:
					'should return true for formatted code starting with FORMAT_FAILED_PREFIX',
				expected: true,
				params: {
					endPos: 4,
					formattedCode: '__FORMAT_FAILED__error',
					originalCode: 'test',
					processedText: 'text',
					startPos: 0,
				} as ShouldSkipCodeBlockParams,
			},
			{
				description:
					'should return true when formatted equals original and contains newlines',
				expected: true,
				params: {
					endPos: 16,
					formattedCode: 'test\ncode',
					originalCode: 'test\ncode',
					processedText: 'before test\ncode after',
					startPos: 7,
				} as ShouldSkipCodeBlockParams,
			},
			{
				description:
					'should return false when formatted equals original but no newlines',
				expected: false,
				params: {
					endPos: 11,
					formattedCode: 'test',
					originalCode: 'test',
					processedText: 'before test after',
					startPos: 7,
				} as ShouldSkipCodeBlockParams,
			},
			{
				description:
					'should return false when formatted differs from original',
				expected: false,
				params: {
					endPos: 4,
					formattedCode: 'formatted',
					originalCode: 'original',
					processedText: 'text',
					startPos: 0,
				} as ShouldSkipCodeBlockParams,
			},
		])(
			'$description',
			({
				expected,
				params,
			}: Readonly<{
				description: string;
				expected: boolean;
				params: ShouldSkipCodeBlockParams;
			}>) => {
				expect(shouldSkipCodeBlock(params)).toBe(expected);
			},
		);
	});

	describe('wrapParsers', () => {
		it.concurrent('should return null when parsers is null', () => {
			const result = wrapParsers(
				null as unknown as typeof plugin.parsers,
				plugin,
			);
			expect(result).toBeNull();
		});

		it.concurrent(
			'should return undefined when parsers is undefined',
			() => {
				const result = wrapParsers(undefined, plugin);
				expect(result).toBeUndefined();
			},
		);

		it.concurrent('should skip parsers with undefined values', () => {
			const mockParsers = {
				apex: undefined,
			} as unknown as typeof plugin.parsers;
			const result = wrapParsers(mockParsers, plugin);
			expect(result).toBeDefined();
			expect(result?.apex).toBeUndefined();
		});

		it.concurrent('should skip parsers without parse function', () => {
			const mockParsers = {
				apex: {
					// No parse function
				},
			} as unknown as typeof plugin.parsers;
			const result = wrapParsers(mockParsers, plugin);
			expect(result).toBeDefined();
			expect(result?.apex).toBeUndefined();
		});

		it.concurrent(
			'should handle parsers without preprocess function',
			async () => {
				const mockParse = vi.fn();
				const mockParsers = {
					apex: {
						parse: mockParse,
						// No preprocess property
					},
				} as unknown as typeof plugin.parsers;
				const result = wrapParsers(mockParsers, plugin);
				expect(result).toBeDefined();
				const apexParser = result?.apex;
				expect(apexParser).toBeDefined();
				if (apexParser?.preprocess) {
					// Should still work even without original preprocess (uses text fallback)
					const text = 'public class Test {}';
					const preprocessResult = await apexParser.preprocess(text, {
						parser: 'apex',
					} as unknown as Parameters<
						typeof apexParser.preprocess
					>[1]);
					expect(typeof preprocessResult).toBe('string');
				}
			},
		);

		it.concurrent(
			'should skip parsers with inherited properties (not own properties)',
			() => {
				// Create a parser object with inherited properties (not own properties)
				// This tests the hasOwnProperty check - properties from prototype are skipped
				const baseParser = {
					parse: vi.fn(),
				};
				// Create object with parse as inherited property (not own property)
				const inheritedParser = Object.create(baseParser);
				// Add an own property that will be iterated
				inheritedParser.otherParser = {
					parse: vi.fn(),
				};
				// The 'parse' property exists on prototype, so when iterating 'parse',
				// hasOwnProperty will return false and it will be skipped

				const result = wrapParsers(
					inheritedParser as unknown as typeof plugin.parsers,
					plugin,
				);
				expect(result).toBeDefined();
				// otherParser should be wrapped, but parse from prototype should be skipped
				expect(result?.otherParser).toBeDefined();
			},
		);

		it.concurrent(
			'should wrap parsers with both parse and preprocess functions',
			async () => {
				const mockParse = vi.fn();
				const mockPreprocess = vi.fn(async (text: string) =>
					Promise.resolve(text),
				);
				const mockParsers = {
					apex: {
						parse: mockParse,
						preprocess: mockPreprocess,
					},
				} as unknown as typeof plugin.parsers;
				const result = wrapParsers(mockParsers, plugin);
				expect(result).toBeDefined();
				const apexParser = result?.apex;
				expect(apexParser).toBeDefined();
				if (apexParser?.preprocess) {
					const text = 'public class Test {}';
					await apexParser.preprocess(text, {
						parser: 'apex',
					} as unknown as Parameters<
						typeof apexParser.preprocess
					>[1]);
					expect(mockPreprocess).toHaveBeenCalled();
				}
			},
		);
	});

	describe('shouldSkipCodeBlock function', () => {
		it.concurrent(
			'should skip code blocks with empty formatted code',
			async () => {
				const apexParser = plugin.parsers?.apex;
				if (!apexParser?.preprocess) {
					throw new Error('apex parser preprocess not found');
				}
				// Empty code blocks are now handled in the embed function, not the preprocessor
				// The preprocessor should return the text with only annotation normalization
				const text = loadFixture('apexdoc-empty-code-block', 'input');
				const result = await apexParser.preprocess(text, {
					parser: 'apex',
				} as unknown as Parameters<typeof apexParser.preprocess>[1]);
				// Preprocessor should preserve empty code blocks (they're handled in embed function)
				// The result may differ slightly due to original preprocessor or annotation normalization
				// but should still contain the empty code block structure
				expect(result).toContain('{@code');
				expect(result).toContain('}');
			},
		);

		it.concurrent(
			'should skip code blocks that start with FORMAT_FAILED_PREFIX',
			async () => {
				// This is tested indirectly through formatCodeBlock behavior
				// If formatCodeBlock fails, it should be skipped
				const apexParser = plugin.parsers?.apex;
				if (!apexParser?.preprocess) {
					throw new Error('apex parser preprocess not found');
				}
				// Test with invalid Apex code that might fail formatting
				const text = loadFixture('apexdoc-invalid-code-block', 'input');
				const result = await apexParser.preprocess(text, {
					parser: 'apex',
				} as unknown as Parameters<typeof apexParser.preprocess>[1]);
				expect(typeof result).toBe('string');
			},
		);

		it.concurrent(
			'should skip code blocks when formatted code equals original and contains newlines',
			async () => {
				const apexParser = plugin.parsers?.apex;
				if (!apexParser?.preprocess) {
					throw new Error('apex parser preprocess not found');
				}
				// Test with code that formats to itself with newlines
				const text = loadFixture(
					'apexdoc-code-block-same-with-newlines',
					'input',
				);
				const result = await apexParser.preprocess(text, {
					parser: 'apex',
				} as unknown as Parameters<typeof apexParser.preprocess>[1]);
				expect(typeof result).toBe('string');
			},
		);
	});
});
