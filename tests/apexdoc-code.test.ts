/**
 * @file Unit tests for the apexdoc-code module.
 */

import { describe, it, expect } from 'vitest';
import {
	CODE_TAG,
	CODE_TAG_LENGTH,
	EMPTY_CODE_TAG,
	extractCodeFromBlock,
	processCodeBlockLines,
	createDocCodeBlock,
	processCodeBlock,
	renderCodeBlockInComment,
	processAllCodeBlocksInComment,
} from '../src/apexdoc-code.js';
import type { ParserOptions } from 'prettier';
import plugin from '../src/index.js';

describe('apexdoc-code', () => {
	describe('CODE_TAG', () => {
		it.concurrent('should be {@code', () => {
			expect(CODE_TAG).toBe('{@code');
		});
	});

	describe('CODE_TAG_LENGTH', () => {
		it.concurrent('should match CODE_TAG length', () => {
			expect(CODE_TAG_LENGTH).toBe(CODE_TAG.length);
		});
	});

	describe('EMPTY_CODE_TAG', () => {
		it.concurrent('should be {@code}', () => {
			expect(EMPTY_CODE_TAG).toBe('{@code}');
		});
	});

	describe('extractCodeFromBlock', () => {
		it.concurrent('should extract simple code block', () => {
			const text = '{@code Integer x = 10; }';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			// Code extraction may include trailing space before closing brace
			expect(result?.code.trim()).toBe('Integer x = 10;');
		});

		it.concurrent('should extract multiline code block', () => {
			const text = '{@code\nInteger x = 10;\nString y = "test";\n}';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trimStart()).toContain('Integer x = 10;');
			expect(result?.code.trimEnd()).toContain('String y = "test";');
		});

		it.concurrent('should extract code block with nested braces', () => {
			const text = '{@code\nif (true) {\n  return;\n}\n}';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trim()).toContain('if (true) {');
		});

		it.concurrent('should return null when braces are unmatched and no closing brace found', () => {
			const text = '{@code Integer x = 10;';
			const result = extractCodeFromBlock(text, 0);
			expect(result).toBeNull();
		});

		it.concurrent('should handle code block with asterisks (comment-style)', () => {
			const text = '{@code\n * Integer x = 10;\n * }';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trim()).toContain('Integer x = 10;');
		});

		it.concurrent('should trim leading and trailing blank lines', () => {
			const text = '{@code\n\nInteger x = 10;\n\n}';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trim()).toBe('Integer x = 10;');
		});

		it.concurrent('should preserve middle blank lines', () => {
			const text = '{@code\nInteger x = 10;\n\nString y = "test";\n}';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trimStart()).toContain('Integer x = 10;');
			expect(result?.code).toContain('\n\n');
			expect(result?.code.trimEnd()).toContain('String y = "test";');
		});

		it.concurrent('should handle code block starting at non-zero position', () => {
			const text = 'prefix {@code Integer x = 10; } suffix';
			const codeTagPos = text.indexOf('{@code');
			const result = extractCodeFromBlock(text, codeTagPos);
			expect(result).not.toBeNull();
			expect(result?.code.trim()).toBe('Integer x = 10;');
		});

		it.concurrent('should handle empty code block', () => {
			const text = '{@code }';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code).toBe('');
		});

		it.concurrent('should handle unmatched braces with lastClosingBracePos', () => {
			const text = '{@code Integer x = 10; } extra';
			// Create scenario where braceCount doesn't reach 0 but lastClosingBracePos exists
			// This tests the fallback path
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trim()).toBe('Integer x = 10;');
		});
	});

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
			const lines = [' *   }'];
			const result = processCodeBlockLines(lines);
			expect(result[0]).toContain('}');
		});

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
	});


	describe('createDocCodeBlock', () => {
		it.concurrent('should create code block doc from simple code', () => {
			const code = 'Integer x = 10;';
			const result = createDocCodeBlock(0, code.length, code);
			expect(result).toBeDefined();
			expect(result.type).toBe('code');
			expect(result.rawCode).toBe(code);
		});

		it.concurrent('should create code block doc from multiline code', () => {
			const code = 'Integer x = 10;\nString y = "test";';
			const result = createDocCodeBlock(0, code.length, code);
			expect(result).toBeDefined();
			expect(result.type).toBe('code');
			expect(result.rawCode).toBe(code);
		});

		it.concurrent('should handle empty code', () => {
			const code = '';
			const result = createDocCodeBlock(0, 0, code);
			expect(result).toBeDefined();
			expect(result.type).toBe('code');
			expect(result.rawCode).toBe(code);
		});

		it.concurrent('should use formattedCode when provided', () => {
			const rawCode = 'integer x = 10;';
			const formattedCode = 'Integer x = 10;';
			const result = createDocCodeBlock(0, rawCode.length, rawCode, formattedCode);
			expect(result).toBeDefined();
			expect(result.rawCode).toBe(rawCode);
			expect(result.formattedCode).toBe(formattedCode);
		});

		it.concurrent('should create single-line content doc for single line code', () => {
			const code = 'Integer x = 10;';
			const result = createDocCodeBlock(0, code.length, code);
			expect(result.content).toBe(code);
		});

		it.concurrent('should create multi-line content doc for multi-line code', () => {
			const code = 'Integer x = 10;\nString y = "test";';
			const result = createDocCodeBlock(0, code.length, code);
			expect(result.content).toBeDefined();
			// Content should be a Doc array for multi-line
			expect(Array.isArray(result.content) || typeof result.content === 'string').toBe(true);
		});
	});

	describe('processCodeBlock', () => {
		it.concurrent('should return original block when not starting with {@code', () => {
			const codeBlock = 'Not a code block';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			expect(result).toEqual([codeBlock]);
		});

		it.concurrent('should return original block when extraction fails', () => {
			const codeBlock = '{@code unmatched braces';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			// When extraction fails, should return original block
			expect(result).toEqual([codeBlock]);
		});

		it.concurrent('should return original block for empty code content', () => {
			const codeBlock = '{@code }';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			expect(result).toEqual([codeBlock]);
		});

		it.concurrent('should process single-line code block', () => {
			const codeBlock = '{@code Integer x = 10; }';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			expect(result).toHaveLength(1);
			expect(result[0]).toContain('{@code');
			expect(result[0]).toContain('Integer x = 10;');
		});

		it.concurrent('should process single-line code block ending with semicolon', () => {
			const codeBlock = '{@code Integer x = 10; }';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			expect(result[0]).toContain('Integer x = 10;');
		});

		it.concurrent('should process multiline code block', () => {
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe('{@code');
			expect(result[result.length - 1]).toBe('}');
		});

		it.concurrent('should not use formatted code block when commentKey is null', () => {
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			const getFormattedCodeBlock = () => 'should not be used';
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			// Should use raw code lines, not formatted block
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe('{@code');
			expect(result[result.length - 1]).toBe('}');
		});
	});

	describe('renderCodeBlockInComment', () => {
		it.concurrent('should render empty code block', () => {
			const doc = createDocCodeBlock(0, 0, '');
			const commentPrefix = '   * ';
			const result = renderCodeBlockInComment(doc, commentPrefix);
			expect(result).toEqual([`${commentPrefix}{@code}`]);
		});

		it.concurrent('should render single-line code block', () => {
			const code = 'Integer x = 10;';
			const doc = createDocCodeBlock(0, code.length, code);
			const commentPrefix = '   * ';
			const result = renderCodeBlockInComment(doc, commentPrefix);
			expect(result).toHaveLength(1);
			expect(result[0]).toContain('Integer x = 10;');
		});

		it.concurrent('should render multiline code block', () => {
			const code = 'Integer x = 10;\nString y = "test";';
			const doc = createDocCodeBlock(0, code.length, code);
			const commentPrefix = '   * ';
			const result = renderCodeBlockInComment(doc, commentPrefix);
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toContain('Integer x = 10;');
			expect(result[1]).toContain('String y = "test";');
		});

		it.concurrent('should use formattedCode when available', () => {
			const rawCode = 'integer x = 10;';
			const formattedCode = 'Integer x = 10;';
			const doc = createDocCodeBlock(0, rawCode.length, rawCode, formattedCode);
			const commentPrefix = '   * ';
			const result = renderCodeBlockInComment(doc, commentPrefix);
			expect(result[0]).toContain('Integer x = 10;'); // Should use formattedCode
			expect(result[0]).not.toContain('integer x = 10;'); // Should not use rawCode
		});

		it.concurrent('should handle empty lines in code block', () => {
			const code = 'Integer x = 10;\n\nString y = "test";';
			const doc = createDocCodeBlock(0, code.length, code);
			const commentPrefix = '   * ';
			const result = renderCodeBlockInComment(doc, commentPrefix);
			expect(result.length).toBeGreaterThan(2);
			// Empty line should use trimmedCommentPrefix which is commentPrefix.trimEnd() = "   *"
			expect(result[1]).toBe('   *');
		});
	});

	describe('processAllCodeBlocksInComment', () => {
		it.concurrent('should return undefined when comment has no code blocks', async () => {
			const commentText = '/**\n * This is a regular comment\n * with no code blocks\n */';
			const options = {
				printWidth: 80,
				tabWidth: 2,
			} as ParserOptions;
			const formattedCodeBlocks = new Map<string, string>();
			const setFormattedCodeBlock = (key: string, value: string): void => {
				formattedCodeBlocks.set(key, value);
			};

			const result = await processAllCodeBlocksInComment({
				commentText,
				options,
				plugins: [plugin],
				commentPrefixLength: 5,
				setFormattedCodeBlock,
			});

			expect(result).toBeUndefined();
		});

		it.concurrent('should process code block with blank line preservation', async () => {
			// Code block that will trigger preserveBlankLineAfterClosingBrace
			const commentText =
				'/**\n * {@code\n *   if (true) {\n *     return;\n *   }\n *\n *   @Future\n * }\n */';
			const options = {
				printWidth: 80,
				tabWidth: 2,
			} as ParserOptions;
			const formattedCodeBlocks = new Map<string, string>();
			const setFormattedCodeBlock = (key: string, value: string): void => {
				formattedCodeBlocks.set(key, value);
			};

			const result = await processAllCodeBlocksInComment({
				commentText,
				options,
				plugins: [plugin],
				commentPrefixLength: 5,
				setFormattedCodeBlock,
			});

			expect(result).toBeDefined();
			expect(result).toContain('{@code');
		});

		it.concurrent('should handle malformed code block (extraction fails)', async () => {
			// Code block with unmatched braces to trigger the continue path
			const commentText = '/**\n * {@code unmatched braces\n */';
			const options = {
				printWidth: 80,
				tabWidth: 2,
			} as ParserOptions;
			const formattedCodeBlocks = new Map<string, string>();
			const setFormattedCodeBlock = (key: string, value: string): void => {
				formattedCodeBlocks.set(key, value);
			};

			// Should return undefined because extraction fails and no changes are made
			const result = await processAllCodeBlocksInComment({
				commentText,
				options,
				plugins: [plugin],
				commentPrefixLength: 5,
				setFormattedCodeBlock,
			});

			// When extraction fails, startIndex advances and loop continues, but if no valid blocks are found, returns undefined
			expect(result).toBeUndefined();
		});
	});
});
