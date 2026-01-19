/**
 * @file Unit tests for code processing functions in the apexdoc-code module.
 */

import { describe, it, expect } from 'vitest';
import type { ParserOptions } from 'prettier';
import {
	processCodeBlockLines,
	processCodeBlock,
	processAllCodeBlocksInComment,
} from '../../src/apexdoc-code.js';
import plugin from '../../src/index.js';

describe('apexdoc-code', () => {
	describe('processCodeBlockLines', () => {
		it.concurrent('should process lines with code block', () => {
			const lines = [' * {@code', ' *   Integer x = 10;', ' * }'];
			const result = processCodeBlockLines(lines);
			expect(result).toHaveLength(3);
			expect(result[0]).toContain('{@code');
			expect(result[1]).toContain('Integer x = 10;');
		});

		it.concurrent('should handle lines without code block', () => {
			const lines = [' * Regular comment line', ' * Another line'];
			const result = processCodeBlockLines(lines);
			expect(result).toHaveLength(2);
		});

		it.concurrent('should handle nested braces in code block', () => {
			const lines = [
				' * {@code',
				' *   if (true) {',
				' *     return;',
				' *   }',
				' * }',
			];
			const result = processCodeBlockLines(lines);
			expect(result).toHaveLength(5);
		});

		it.concurrent('should handle standalone closing brace', () => {
			// Test the standalone '}' case
			// First line should have no leading space prefix
			const lines = [' *   }'];
			const result = processCodeBlockLines(lines);
			expect(result[0]).toContain('}');
			// Should preserve the asterisk and whitespace structure
			expect(result[0]).toBe('*   }');

			// Test with multiple lines to verify spacing is preserved for subsequent lines
			const lines2 = [' * Line 1', ' *   }'];
			const result2 = processCodeBlockLines(lines2);
			// Second line should have leading space to align with first line
			expect(result2[1]).toBe(' *   }');
		});

		it.concurrent(
			'should handle code block ending on standalone closing brace line',
			() => {
				const lines = [' * {@code', ' *   Integer x = 10;', ' * }'];
				const result = processCodeBlockLines(lines);
				expect(result.length).toBe(3);
				expect(result[2]).toContain('}');

				// Verify subsequent processing after code block ends
				const linesAfter = [
					' * {@code',
					' *   Integer x = 10;',
					' * }',
					' * More text',
				];
				const resultAfter = processCodeBlockLines(linesAfter);
				expect(resultAfter[3]).toContain('More text');
			},
		);

		it.concurrent('should handle empty lines array', () => {
			const lines: readonly string[] = [];
			const result = processCodeBlockLines(lines);
			expect(result).toHaveLength(0);
		});

		it.concurrent('should handle single line code block', () => {
			const lines = [' * {@code Integer x = 10; }'];
			const result = processCodeBlockLines(lines);
			expect(result[0]).toContain('{@code');
		});

		it.concurrent(
			'should handle code block ending on line with content',
			() => {
				const lines = [' * {@code', ' *   Integer x = 1; }'];
				const result = processCodeBlockLines(lines);
				expect(result).toHaveLength(2);
				expect(result[0]).toContain('{@code');
				expect(result[1]).toContain('Integer x = 1;');
				expect(result[1]).toContain('}');
			},
		);

		it.concurrent(
			'should handle code block content line with willEnd=false',
			() => {
				const lines = ['{@code', '  Integer x = 10;', '}'];
				const result = processCodeBlockLines(lines);
				expect(result).toHaveLength(3);
				expect(result[0]).toContain('{@code');
				expect(result[1]).toContain('Integer x = 10;');
				expect(result[1]).not.toContain('}');
				expect(result[2]).toContain('}');
			},
		);

		it.concurrent(
			'should handle code block content line with willEnd=true',
			() => {
				const lines = [' * {@code', ' *   Integer x = 10; }'];
				const result = processCodeBlockLines(lines);
				expect(result).toHaveLength(2);
				expect(result[0]).toContain('{@code');
				expect(result[1]).toContain('Integer x = 10;');
				expect(result[1]).toContain('}');

				// Verify that the next line (if any) would not be in code block
				const linesWithMore = [
					' * {@code',
					' *   Integer x = 10; }',
					' * More text',
				];
				const resultWithMore = processCodeBlockLines(linesWithMore);
				expect(resultWithMore).toHaveLength(3);
				expect(resultWithMore[2]).toContain('More text');
			},
		);
	});

	describe('processCodeBlock', () => {
		it.concurrent(
			'should return original block when not starting with {@code',
			() => {
				const codeBlock = 'Not a code block';
				const getFormattedCodeBlock = (): undefined => undefined;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {} as ParserOptions;
				const result = processCodeBlock(
					codeBlock,
					options,
					getFormattedCodeBlock,
					null,
					options,
				);
				expect(result).toEqual([codeBlock]);
			},
		);

		it.concurrent(
			'should return original block when extraction fails',
			() => {
				const codeBlock = '{@code unmatched braces';
				const getFormattedCodeBlock = (): undefined => undefined;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {} as ParserOptions;
				const result = processCodeBlock(
					codeBlock,
					options,
					getFormattedCodeBlock,
					null,
					options,
				);
				// When extraction fails, should return original block
				expect(result).toEqual([codeBlock]);
			},
		);

		it.concurrent(
			'should return original block for empty code content',
			() => {
				const codeBlock = '{@code }';
				const getFormattedCodeBlock = (): undefined => undefined;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {} as ParserOptions;
				const result = processCodeBlock(
					codeBlock,
					options,
					getFormattedCodeBlock,
					null,
					options,
				);
				expect(result).toEqual([codeBlock]);
			},
		);

		it.concurrent('should process single-line code block', () => {
			const codeBlock = '{@code Integer x = 10; }';
			const getFormattedCodeBlock = (): undefined => undefined;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
			const options = {} as ParserOptions;
			const result = processCodeBlock(
				codeBlock,
				options,
				getFormattedCodeBlock,
				null,
				options,
			);
			expect(result).toHaveLength(1);
			expect(result[0]).toContain('{@code');
			expect(result[0]).toContain('Integer x = 10;'); // includes semicolon
		});

		it.concurrent('should process multiline code block', () => {
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			const getFormattedCodeBlock = (): undefined => undefined;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
			const options = {} as ParserOptions;
			const result = processCodeBlock(
				codeBlock,
				options,
				getFormattedCodeBlock,
				null,
				options,
			);
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe('{@code');
			expect(result[result.length - 1]).toBe('}');
		});

		it.concurrent(
			'should not use formatted code block when commentKey is null',
			() => {
				const codeBlock =
					'{@code\nInteger x = 10;\nString y = "test";\n}';
				const getFormattedCodeBlock = (): string =>
					'should not be used';
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {} as ParserOptions;
				const result = processCodeBlock(
					codeBlock,
					options,
					getFormattedCodeBlock,
					null,
					options,
				);
				// Should use raw code lines, not formatted block
				expect(result.length).toBeGreaterThan(1);
				expect(result[0]).toBe('{@code');
				expect(result[result.length - 1]).toBe('}');
			},
		);

		it.concurrent(
			'should use extractCodeFromEmbedResult when embedResult exists',
			() => {
				const codeBlock =
					'{@code\nInteger x = 10;\nString y = "test";\n}';
				// Mock formatted embed result with comment structure ending with \n */\n
				const embedResult =
					'/**\n * {@code\n *   Integer x = 10;\n *   String y = "test";\n * }\n */\n';
				const getFormattedCodeBlock = (
					key: string,
				): string | undefined => {
					if (key === 'test-key') return embedResult;
					return undefined;
				};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {} as ParserOptions;
				const result = processCodeBlock(
					codeBlock,
					options,
					getFormattedCodeBlock,
					'test-key',
					options,
				);
				// Should use extractCodeFromEmbedResult to extract lines from embedResult
				expect(result.length).toBeGreaterThan(1);
				expect(result[0]).toBe('{@code');
				expect(result[result.length - 1]).toBe('}');
				// Should contain extracted code lines
				expect(
					result.some((line) => line.includes('Integer x = 10;')),
				).toBe(true);
			},
		);

		it.concurrent('should handle embedResult ending with \n */', () => {
			// Test else if (embedContent.endsWith('\n */')) branch
			// Need embedResult that ends with \n */ but NOT \n */\n
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			// After removing '/**\n' prefix, content ends with \n */ (no trailing newline)
			// This requires embedResult to not end with \n */\n after prefix removal
			// Create embedResult that after prefix removal ends with just \n */
			const embedResult =
				'/**\n * {@code\n *   Integer x = 10;\n *   String y = "test";\n * }\n */';
			const getFormattedCodeBlock = (key: string): string | undefined => {
				if (key === 'test-key') return embedResult;
				return undefined;
			};
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
			const options = {} as ParserOptions;
			const result = processCodeBlock(
				codeBlock,
				options,
				getFormattedCodeBlock,
				'test-key',
				options,
			);
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe('{@code');
		});

		it.concurrent(
			'should handle embedResult not starting with /**\\n',
			() => {
				// Test false branch when embedContent doesn't start with '/**\n'
				const codeBlock =
					'{@code\nInteger x = 10;\nString y = "test";\n}';
				// Embed result without '/**\n' prefix
				const embedResult =
					' * {@code\n *   Integer x = 10;\n *   String y = "test";\n * }\n */\n';
				const getFormattedCodeBlock = (
					key: string,
				): string | undefined => {
					if (key === 'test-key') return embedResult;
					return undefined;
				};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {} as ParserOptions;
				const result = processCodeBlock(
					codeBlock,
					options,
					getFormattedCodeBlock,
					'test-key',
					options,
				);
				expect(result.length).toBeGreaterThan(1);
				expect(result[0]).toBe('{@code');
			},
		);

		it.concurrent(
			'should handle lines without asterisk in extractCodeFromEmbedResult',
			() => {
				const codeBlock =
					'{@code\nInteger x = 10;\nString y = "test";\n}';
				// Mock formatted embed result with lines that don't start with asterisk after whitespace
				// This triggers return line; when line doesn't have asterisk
				const embedResult =
					'/**\n * {@code\n *   Line with asterisk\nPlain line without asterisk\n * }\n */\n';
				const getFormattedCodeBlock = (
					key: string,
				): string | undefined => {
					if (key === 'test-key') return embedResult;
					return undefined;
				};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {} as ParserOptions;
				const result = processCodeBlock(
					codeBlock,
					options,
					getFormattedCodeBlock,
					'test-key',
					options,
				);
				// Should handle lines without asterisk
				expect(result.length).toBeGreaterThan(1);
				expect(result[0]).toBe('{@code');
				expect(result[result.length - 1]).toBe('}');
			},
		);

		it.concurrent('should handle asterisk without space after it', () => {
			// Test if (start < line.length && line[start] === ' ') false branch
			// When line has '*' followed by non-space character (like '*text' instead of '* text')
			// Use multiline codeBlock to ensure extractCodeFromEmbedResult is called
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			const embedResult = '/**\n * {@code\n *text\n *more\n * }\n */\n';
			const getFormattedCodeBlock = (key: string): string | undefined => {
				if (key === 'test-key') return embedResult;
				return undefined;
			};
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
			const options = {} as ParserOptions;
			const result = processCodeBlock(
				codeBlock,
				options,
				getFormattedCodeBlock,
				'test-key',
				options,
			);
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe('{@code');
		});

		it.concurrent('should handle embedResult without code markers', () => {
			// Use multiline codeBlock to avoid early return for single-line code
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			// Mock formatted embed result without {@code markers - should use fallback extraction
			// Embed result has ApexDoc comment structure with multiple lines
			const embedResult = '/**\n * Line 1\n * Line 2\n * Line 3\n */\n';
			const getFormattedCodeBlock = (key: string): string | undefined => {
				if (key === 'test-key') return embedResult;
				return undefined;
			};
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
			const options = {} as ParserOptions;
			const result = processCodeBlock(
				codeBlock,
				options,
				getFormattedCodeBlock,
				'test-key',
				options,
			);
			// Should fall back to extracting content when code markers not found
			// Result should be wrapped in {@code ... }, with at least 3 elements
			expect(result.length).toBeGreaterThanOrEqual(3);
			expect(result[0]).toBe('{@code');
			expect(result[result.length - 1]).toBe('}');
			// Should contain the extracted line from slice fallback
			expect(result.some((line) => line.includes('Line 3'))).toBe(true);
		});
	});

	describe('processAllCodeBlocksInComment', () => {
		const createProcessAllArgs = (
			commentText: string,
		): Parameters<typeof processAllCodeBlocksInComment>[0] => {
			const formattedCodeBlocks = new Map<string, string>();
			const setFormattedCodeBlock = (
				key: string,
				value: string,
			): void => {
				formattedCodeBlocks.set(key, value);
			};
			return {
				commentPrefixLength: 5,
				commentText,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				options: { printWidth: 80, tabWidth: 2 } as ParserOptions,
				plugins: [plugin],
				setFormattedCodeBlock,
			};
		};

		it.concurrent(
			'should return undefined when comment has no code blocks',
			async () => {
				const commentText =
					'/**\n * This is a regular comment\n * with no code blocks\n */';

				const result = await processAllCodeBlocksInComment(
					createProcessAllArgs(commentText),
				);

				expect(result).toBeUndefined();
			},
		);

		it.concurrent(
			'should process code block with blank line preservation',
			async () => {
				// Code block that will trigger preserveBlankLineAfterClosingBrace
				// Need code that formats to have } followed by @annotation or access modifier
				const commentText =
					'/**\n * {@code\n *   public void method() {\n *     return;\n *   }\n *   @Future\n *   public void next() {}\n * }\n */';

				const result = await processAllCodeBlocksInComment(
					createProcessAllArgs(commentText),
				);

				expect(result).toBeDefined();
				expect(result).toContain('{@code');
				// Should have preserved blank line after closing brace when followed by @Future or public
			},
		);

		it.concurrent(
			'should handle empty code block when beforeCode ends with newline',
			async () => {
				// Test when code block is empty and no leading newline is needed
				// This happens when there's already a blank line before the code block
				// Need blank line without ' * ' prefix before code block
				// Format: /**\n * text\n\n{@code } - blank line has no ' * ' prefix
				const commentText = '/**\n * Some text before\n\n{@code }\n */';

				const result = await processAllCodeBlocksInComment(
					createProcessAllArgs(commentText),
				);

				expect(result).toBeDefined();
				expect(result).toContain('{@code');
			},
		);

		it.concurrent(
			'should handle malformed code block (extraction fails)',
			async () => {
				// Code block with unmatched braces to trigger the continue path
				const commentText = '/**\n * {@code unmatched braces\n */';

				// Should return undefined because extraction fails and no changes are made
				const result = await processAllCodeBlocksInComment(
					createProcessAllArgs(commentText),
				);

				// When extraction fails, startIndex advances and loop continues, but if no valid blocks are found, returns undefined
				expect(result).toBeUndefined();
			},
		);
	});
});
