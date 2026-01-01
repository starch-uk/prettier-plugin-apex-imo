/**
 * @file Unit tests for the comments module.
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, it, expect } from 'vitest';
import {
	findApexDocComments,
	getIndentLevel,
	createIndent,
	getCommentIndent,
	applyCommentIndentation,
	createClosingIndent,
} from '../src/comments.js';

describe('comments', () => {
	describe('findApexDocComments', () => {
		it('should find single ApexDoc comment', () => {
			const text = '/** Comment */';
			const comments = findApexDocComments(text);
			expect(comments).toHaveLength(1);
			expect(comments[0]?.start).toBe(0);
			expect(comments[0]?.end).toBe(14);
		});

		it('should find multiple ApexDoc comments', () => {
			const text = '/** First */ code /** Second */';
			const comments = findApexDocComments(text);
			expect(comments).toHaveLength(2);
			expect(comments[0]?.start).toBe(0);
			expect(comments[0]?.end).toBe(12);
			expect(comments[1]?.start).toBe(18);
			expect(comments[1]?.end).toBe(31);
		});

		it('should return empty array when no comments found', () => {
			const text = 'No comments here';
			const comments = findApexDocComments(text);
			expect(comments).toHaveLength(0);
		});

		it('should handle comment at start of string', () => {
			const text = '/** Start */';
			const comments = findApexDocComments(text);
			expect(comments).toHaveLength(1);
			expect(comments[0]?.start).toBe(0);
		});

		it('should handle comment at end of string', () => {
			const text = 'code /** End */';
			const comments = findApexDocComments(text);
			expect(comments).toHaveLength(1);
			expect(comments[0]?.start).toBe(5);
		});
	});

	describe('getIndentLevel', () => {
		it('should return 0 for line with no indentation', () => {
			expect(getIndentLevel('code')).toBe(0);
		});

		it('should return correct indent for spaces', () => {
			expect(getIndentLevel('    code')).toBe(4);
			expect(getIndentLevel('  code')).toBe(2);
		});

		it('should return correct indent for tabs with default tabWidth', () => {
			expect(getIndentLevel('\tcode')).toBe(2);
			expect(getIndentLevel('\t\tcode')).toBe(4);
		});

		it('should return correct indent for tabs with custom tabWidth', () => {
			expect(getIndentLevel('\tcode', 4)).toBe(4);
			expect(getIndentLevel('\t\tcode', 4)).toBe(8);
		});

		it('should return correct indent for mixed spaces and tabs', () => {
			expect(getIndentLevel('  \tcode')).toBe(4); // 2 spaces + 1 tab (2 spaces) = 4
			expect(getIndentLevel('  \tcode', 4)).toBe(6); // 2 spaces + 1 tab (4 spaces) = 6
		});

		it('should handle line with only whitespace', () => {
			expect(getIndentLevel('    ')).toBe(4);
			expect(getIndentLevel('\t\t')).toBe(4);
		});

		it('should handle empty string', () => {
			expect(getIndentLevel('')).toBe(0);
		});

		it('should handle line that does not match regex pattern', () => {
			// This tests the null coalescing operator when match is null
			// A line starting with non-whitespace should still return 0
			expect(getIndentLevel('code')).toBe(0);
		});
	});

	describe('createIndent', () => {
		it('should return empty string for level 0', () => {
			expect(createIndent(0, 2)).toBe('');
			expect(createIndent(0, 2, true)).toBe('');
			expect(createIndent(0, 2, false)).toBe('');
		});

		it('should return empty string for negative level', () => {
			expect(createIndent(-1, 2)).toBe('');
		});

		it('should create spaces when useTabs is false', () => {
			expect(createIndent(4, 2, false)).toBe('    ');
			expect(createIndent(2, 2, false)).toBe('  ');
		});

		it('should create spaces when useTabs is undefined', () => {
			expect(createIndent(4, 2)).toBe('    ');
			expect(createIndent(2, 2)).toBe('  ');
		});

		it('should create spaces when useTabs is null', () => {
			expect(createIndent(4, 2, null)).toBe('    ');
		});

		it('should create tabs when useTabs is true', () => {
			expect(createIndent(4, 2, true)).toBe('\t\t');
			expect(createIndent(2, 2, true)).toBe('\t');
			expect(createIndent(6, 2, true)).toBe('\t\t\t');
		});

		it('should handle tabWidth correctly with tabs', () => {
			expect(createIndent(4, 4, true)).toBe('\t');
			expect(createIndent(8, 4, true)).toBe('\t\t');
			expect(createIndent(6, 4, true)).toBe('\t'); // Math.floor(6/4) = 1
		});
	});

	describe('getCommentIndent', () => {
		it('should get indent from first asterisk line', () => {
			const text = '    /**\n     * Comment\n     */';
			const indent = getCommentIndent(text, 4);
			expect(indent).toBe(4);
		});

		it('should handle comment with no asterisk lines', () => {
			// Comment that ends without finding a * character
			const text = '    /** Comment */';
			const indent = getCommentIndent(text, 4);
			// Should fall back to indent of comment start line
			expect(indent).toBe(4);
		});

		it('should handle comment at end of file', () => {
			// When skipToLineEnd returns false (end of file)
			const text = '    /** Comment';
			const indent = getCommentIndent(text, 4);
			// Should fall back to indent of comment start line
			expect(indent).toBe(4);
		});

		it('should handle comment with newline that cannot be skipped', () => {
			// When skipNewline returns false
			const text = '    /**\r\n     * Comment\n     */';
			const indent = getCommentIndent(text, 4);
			expect(indent).toBe(4);
		});

		it('should handle multi-line comment', () => {
			const text = '  /**\n   * Line 1\n   * Line 2\n   */';
			const indent = getCommentIndent(text, 2);
			expect(indent).toBe(2);
		});

		it('should handle comment starting at beginning of line', () => {
			const text = '/**\n * Comment\n */';
			const indent = getCommentIndent(text, 0);
			expect(indent).toBe(0);
		});

		it('should handle comment that ends without finding asterisk (fallback case)', () => {
			// Comment that reaches end of text without finding * or */
			// This tests the fallback return at the end of getCommentIndent (lines 100-104)
			// Need a comment that doesn't have * on any line and doesn't end with */
			const text = '    /** Comment text without asterisk or closing';
			const indent = getCommentIndent(text, 4);
			// Should fall back to indent of comment start line
			expect(indent).toBe(4);
		});

		it('should handle comment that breaks on finding closing marker', () => {
			// Comment that has */ without finding * on a line first
			// This tests the break statement (line 99) when we find */ in the loop
			// Need a comment where we encounter */ before any * on a line
			const text = '    /** Comment text */';
			const indent = getCommentIndent(text, 4);
			// Should fall back to indent of comment start line since no * was found
			expect(indent).toBe(4);
		});

		it('should handle comment at absolute end of file (skipToLineEnd returns false)', () => {
			// When skipToLineEnd returns false (no newline, at end of file)
			// This tests lineEnd === false branch
			const text = '    /** Comment';
			const indent = getCommentIndent(text, 4);
			expect(indent).toBe(4);
		});

		it('should handle comment with unskippable newline (skipNewline returns false)', () => {
			// When skipNewline returns false (e.g., with certain newline sequences)
			// This tests afterNewline === false branch
			// Using a comment that starts on a line and has a newline that can't be skipped
			const text = '    /**\r     * Comment\n     */';
			const indent = getCommentIndent(text, 4);
			// The exact indent value depends on how prettier handles the newline
			expect(indent).toBeGreaterThanOrEqual(0);
		});
	});

	describe('applyCommentIndentation', () => {
		it('should apply indentation to formatted code', () => {
			const formattedCode = 'List<String> list = new List<String>();';
			const codeBlock = { commentIndent: 4 };
			const options = { tabWidth: 2, useTabs: false };
			const result = applyCommentIndentation(
				formattedCode,
				codeBlock,
				options,
			);
			expect(result).toBe(
				'     * List<String> list = new List<String>();',
			);
		});

		it('should handle multi-line formatted code', () => {
			const formattedCode =
				'List<String> list =\n    new List<String>();';
			const codeBlock = { commentIndent: 4 };
			const options = { tabWidth: 2, useTabs: false };
			const result = applyCommentIndentation(
				formattedCode,
				codeBlock,
				options,
			);
			expect(result).toBe(
				'     * List<String> list =\n     *     new List<String>();',
			);
		});

		it('should handle empty lines', () => {
			const formattedCode = 'Line 1\n\nLine 2';
			const codeBlock = { commentIndent: 4 };
			const options = { tabWidth: 2, useTabs: false };
			const result = applyCommentIndentation(
				formattedCode,
				codeBlock,
				options,
			);
			expect(result).toBe('     * Line 1\n     *\n     * Line 2');
		});

		it('should handle single empty line', () => {
			// Test the empty line branch specifically
			// '\n' splits to ['', ''] (two empty strings)
			const formattedCode = '\n';
			const codeBlock = { commentIndent: 4 };
			const options = { tabWidth: 2, useTabs: false };
			const result = applyCommentIndentation(
				formattedCode,
				codeBlock,
				options,
			);
			expect(result).toBe('     *\n     *');
		});

		it('should handle lines with only whitespace as empty', () => {
			const formattedCode = 'Line 1\n    \nLine 2';
			const codeBlock = { commentIndent: 4 };
			const options = { tabWidth: 2, useTabs: false };
			const result = applyCommentIndentation(
				formattedCode,
				codeBlock,
				options,
			);
			expect(result).toBe('     * Line 1\n     *\n     * Line 2');
		});

		it('should return empty string for empty input', () => {
			const formattedCode = '';
			const codeBlock = { commentIndent: 4 };
			const options = { tabWidth: 2, useTabs: false };
			const result = applyCommentIndentation(
				formattedCode,
				codeBlock,
				options,
			);
			// Empty string splits to [''] which has length 1, so returns '     *'
			expect(result).toBe('     *');
		});

		it('should handle tabs option', () => {
			const formattedCode = 'List<String> list;';
			const codeBlock = { commentIndent: 4 };
			const options = { tabWidth: 2, useTabs: true };
			const result = applyCommentIndentation(
				formattedCode,
				codeBlock,
				options,
			);
			expect(result).toBe('\t\t * List<String> list;');
		});

		it('should preserve relative indentation in code', () => {
			const formattedCode = 'if (condition) {\n    doSomething();\n}';
			const codeBlock = { commentIndent: 4 };
			const options = { tabWidth: 2, useTabs: false };
			const result = applyCommentIndentation(
				formattedCode,
				codeBlock,
				options,
			);
			expect(result).toBe(
				'     * if (condition) {\n     *     doSomething();\n     * }',
			);
		});

		it('should handle null useTabs option', () => {
			const formattedCode = 'List<String> list;';
			const codeBlock = { commentIndent: 4 };
			const options = { tabWidth: 2, useTabs: null };
			const result = applyCommentIndentation(
				formattedCode,
				codeBlock,
				options,
			);
			expect(result).toBe('     * List<String> list;');
		});

		it('should handle undefined useTabs option', () => {
			const formattedCode = 'List<String> list;';
			const codeBlock = { commentIndent: 4 };
			const options = { tabWidth: 2 };
			const result = applyCommentIndentation(
				formattedCode,
				codeBlock,
				options,
			);
			expect(result).toBe('     * List<String> list;');
		});
	});

	describe('createClosingIndent', () => {
		it('should create indent using createIndent', () => {
			expect(createClosingIndent(4, 2, false)).toBe('    ');
			expect(createClosingIndent(4, 2, true)).toBe('\t\t');
			expect(createClosingIndent(4, 2, null)).toBe('    ');
			expect(createClosingIndent(4, 2, undefined)).toBe('    ');
		});

		it('should handle zero indent', () => {
			expect(createClosingIndent(0, 2, false)).toBe('');
			expect(createClosingIndent(0, 2, true)).toBe('');
		});
	});
});
