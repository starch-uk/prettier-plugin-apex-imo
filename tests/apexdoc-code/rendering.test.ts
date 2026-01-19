/**
 * @file Unit tests for code rendering functions in the apexdoc-code module.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ParserOptions } from 'prettier';
import {
	createDocCodeBlock,
	processCodeBlock,
	renderCodeBlockInComment,
} from '../../src/apexdoc-code.js';

describe('apexdoc-code', () => {
	describe('createDocCodeBlock', () => {
		it.concurrent('should create code block doc from simple code', () => {
			const code = 'Integer x = 10;';
			const result = createDocCodeBlock(0, code.length, code);
			expect(result).toBeDefined();
			expect(result.type).toBe('code');
			expect(result.rawCode).toBe(code);
		});

		it.concurrent(
			'should create code block doc from multiline code',
			() => {
				const code = 'Integer x = 10;\nString y = "test";';
				const result = createDocCodeBlock(0, code.length, code);
				expect(result).toBeDefined();
				expect(result.type).toBe('code');
				expect(result.rawCode).toBe(code);
			},
		);

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
			const result = createDocCodeBlock(
				0,
				rawCode.length,
				rawCode,
				formattedCode,
			);
			expect(result).toBeDefined();
			expect(result.rawCode).toBe(rawCode);
			expect(result.formattedCode).toBe(formattedCode);
		});

		it.concurrent(
			'should create single-line content doc for single line code',
			() => {
				const code = 'Integer x = 10;';
				const result = createDocCodeBlock(0, code.length, code);
				expect(result.content).toBe(code);
			},
		);

		it.concurrent(
			'should create multi-line content doc for multi-line code',
			() => {
				const code = 'Integer x = 10;\nString y = "test";';
				const result = createDocCodeBlock(0, code.length, code);
				expect(result.content).toBeDefined();
				// Content should be a Doc array for multi-line
				expect(
					Array.isArray(result.content) ||
						typeof result.content === 'string',
				).toBe(true);
			},
		);
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

		it.concurrent(
			'should render single-line code block without semicolon',
			() => {
				// Test separator when code doesn't end with ';'
				const codeBlock = '{@code Integer x = 10 }';
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {} as ParserOptions;
				const getFormattedCodeBlock = vi.fn(() => undefined);
				const result = processCodeBlock(
					codeBlock,
					options,
					getFormattedCodeBlock,
					null,
					options,
				);
				// Should not have separator when code doesn't end with ';'
				expect(result[0]).toBe('{@code Integer x = 10 }');
			},
		);

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
			const doc = createDocCodeBlock(
				0,
				rawCode.length,
				rawCode,
				formattedCode,
			);
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
});
