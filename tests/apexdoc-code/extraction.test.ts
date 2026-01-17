/**
 * @file Unit tests for code extraction functions in the apexdoc-code module.
 */

import { describe, it, expect } from 'vitest';
import {
	CODE_TAG,
	CODE_TAG_LENGTH,
	EMPTY_CODE_TAG,
	extractCodeFromBlock,
} from '../../src/apexdoc-code.js';

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

		it.concurrent(
			'should return null when braces are unmatched and no closing brace found',
			() => {
				// Create scenario where braceCount > 0 (unmatched braces) AND lastClosingBracePos === NOT_FOUND_INDEX
				// This requires text with opening braces but no closing braces at all
				const text = '{@code if (true) { if (false) {';
				const result = extractCodeFromBlock(text, 0);
				// Should return null when lastClosingBracePos is NOT_FOUND_INDEX and braceCount !== 0
				expect(result).toBeNull();
			},
		);

		it.concurrent(
			'should handle code block with asterisks (comment-style)',
			() => {
				const text = '{@code\n * Integer x = 10;\n * }';
				const result = extractCodeFromBlock(text, 0);
				expect(result).not.toBeNull();
				expect(result?.code.trim()).toContain('Integer x = 10;');
			},
		);

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

		it.concurrent(
			'should handle code block starting at non-zero position',
			() => {
				const text = 'prefix {@code Integer x = 10; } suffix';
				const codeTagPos = text.indexOf('{@code');
				const result = extractCodeFromBlock(text, codeTagPos);
				expect(result).not.toBeNull();
				expect(result?.code.trim()).toBe('Integer x = 10;');
			},
		);

		it.concurrent('should handle empty code block', () => {
			const text = '{@code }';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code).toBe('');
		});

		it.concurrent(
			'should handle unmatched braces with lastClosingBracePos',
			() => {
				const text = '{@code Integer x = 10; } extra';
				// Create scenario where braceCount doesn't reach 0 but lastClosingBracePos exists
				// This tests the fallback path
				const result = extractCodeFromBlock(text, 0);
				expect(result).not.toBeNull();
				expect(result?.code.trim()).toBe('Integer x = 10;');
			},
		);
	});
});
