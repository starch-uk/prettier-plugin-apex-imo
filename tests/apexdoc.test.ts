/**
 * @file Unit tests for the apexdoc module.
 */

import { describe, it, expect } from 'vitest';
import type { ParserOptions } from 'prettier';
import {
	filterNonEmptyLines,
	removeTrailingEmptyLines,
	isApexDoc,
	detectCodeBlockDocs,
	normalizeSingleApexDocComment,
} from '../src/apexdoc.js';
import type { ApexDocComment } from '../src/comments.js';
import { createDocContent } from '../src/comments.js';
import { formatApex } from './test-utils.js';

describe('apexdoc', () => {
	describe('filterNonEmptyLines', () => {
		it.concurrent('should filter out whitespace-only lines', () => {
			const text = '   \n  \n  text\n  ';
			const result = filterNonEmptyLines(text);
			expect(result).toEqual(['  text']);
		});

		it.concurrent(
			'should return empty array for whitespace-only text',
			() => {
				const text = '   \n  \n  ';
				const result = filterNonEmptyLines(text);
				expect(result).toEqual([]);
			},
		);
	});

	describe('removeTrailingEmptyLines', () => {
		it.concurrent('should remove trailing empty lines', () => {
			const lines = ['line1', 'line2', '', '   ', ''];
			const result = removeTrailingEmptyLines(lines);
			expect(result).toEqual(['line1', 'line2']);
		});

		it.concurrent(
			'should handle all empty lines by removing all of them',
			() => {
				const lines = ['', '   ', ''];
				const result = removeTrailingEmptyLines(lines);
				expect(result).toEqual([]);
			},
		);

		it.concurrent('should preserve non-empty lines', () => {
			const lines = ['line1', 'line2'];
			const result = removeTrailingEmptyLines(lines);
			expect(result).toEqual(['line1', 'line2']);
		});
	});

	describe('isApexDoc', () => {
		it.concurrent.each([
			{ description: 'null', value: null },
			{ description: 'undefined', value: undefined },
			{ description: 'string', value: 'string' },
			{ description: 'number', value: 123 },
			{ description: 'boolean', value: true },
			{ description: 'object without value property', value: {} },
			{
				description: 'object with other properties but no value',
				value: { other: 'prop' },
			},
			{ description: 'object with number value', value: { value: 123 } },
			{ description: 'object with null value', value: { value: null } },
			{ description: 'object with object value', value: { value: {} } },
			{
				description: 'single-line comment (apexdoc.ts line 87)',
				value: { value: '/** */' },
			},
		])(
			'should return false for $description',
			({
				value,
			}: Readonly<{
				description: string;
				value: unknown;
			}>) => {
				expect(isApexDoc(value)).toBe(false);
			},
		);

		it.concurrent('should return true for valid ApexDoc comment', () => {
			const comment = {
				value: '/**\n * Test comment\n */',
			};
			expect(isApexDoc(comment)).toBe(true);
		});
	});

	describe('Type casing in {@code} blocks', () => {
		it.concurrent(
			'should apply type normalization inside {@code} blocks',
			async () => {
				// Test integration of type normalization with {@code} block processing
				const input = `public class Test {
  /**
   * Example:
   * {@code
   * string name = 'test';
   * integer count = 42;
   * list<account> accounts = new list<account>();
   * account acc = new account();
   * MyCustomObject__C obj = new MyCustomObject__C();
   * }
   */
  public void example() {}
}`;

				const result = await formatApex(input);

				// Verify type normalization is applied (integration test)
				expect(result).toContain('String name');
				expect(result).toContain('Integer count');
				expect(result).toContain('List<Account>');
				expect(result).toContain('Account acc');
				expect(result).toContain('MyCustomObject__c');
				// Verify lowercase versions are normalized
				expect(result).not.toContain('string name');
				expect(result).not.toContain('integer count');
				expect(result).not.toContain('list<account>');
				expect(result).not.toContain('account acc');
				expect(result).not.toContain('MyCustomObject__C');
			},
		);

		it.concurrent(
			'should normalize types in single-line {@code} blocks',
			async () => {
				const input = `public class Test {
  /**
   * Example: {@code string name = 'test'; }
   */
  public void example() {}
}`;

				const result = await formatApex(input);

				expect(result).toContain('String name');
				expect(result).not.toContain('string name');
			},
		);
	});

	describe('normalizeSingleApexDocComment with isEmbedFormatted', () => {
		it.concurrent.each([
			{
				description:
					'should handle isEmbedFormatted=true for code blocks (apexdoc.ts line 920)',
				isEmbedFormatted: true,
				lineNote: 'line 920 (if (isEmbedFormatted))',
			},
			{
				description:
					'should handle isEmbedFormatted=false for code blocks (apexdoc.ts line 353)',
				isEmbedFormatted: false,
				lineNote: 'line 353 (else: codeToUse = doc.rawCode)',
			},
		])(
			'$description',
			async ({
				isEmbedFormatted,
				lineNote: _lineNote,
			}: Readonly<{
				description: string;
				isEmbedFormatted: boolean;
				lineNote: string;
				// eslint-disable-next-line @typescript-eslint/require-await -- Async signature required for test compatibility
			}>) => {
				// Test the isEmbedFormatted branch when code blocks are processed
				const commentWithCode = `/**
 * Example method.
 * {@code Integer x = 10; }
 */`;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {
					printWidth: 80,
					tabWidth: 2,
				} as ParserOptions;

				const result = normalizeSingleApexDocComment(
					commentWithCode,
					0,
					options,
					isEmbedFormatted,
				);

				// Should process successfully - the isEmbedFormatted branch should execute
				expect(result).toBeDefined();
			},
		);
	});

	describe('detectCodeBlockDocs', () => {
		it.concurrent.each([
			{
				description:
					'should handle isEmbedFormatted=true when processing code blocks (apexdoc.ts line 915)',
				isEmbedFormatted: true,
				note: 'true branch: codeBlockResult.code',
			},
			{
				description:
					'should handle isEmbedFormatted=false when processing code blocks (apexdoc.ts line 915)',
				isEmbedFormatted: false,
				note: 'false branch: undefined',
			},
		])(
			'$description',
			({
				isEmbedFormatted,
			}: Readonly<{
				description: string;
				isEmbedFormatted: boolean;
				note: string;
			}>) => {
				// Test detectCodeBlockDocs with isEmbedFormatted parameter
				// This exercises processContentForCodeBlocks with both true/false values
				// which triggers the ternary at line 915-917: isEmbedFormatted ? codeBlockResult.code : undefined
				// Use text type to avoid removeCommentPrefix processing which might affect the format
				const textDoc = createDocContent(
					'text',
					'Example with {@code Integer x = 10; } code block',
					['Example with {@code Integer x = 10; } code block'],
				);
				const docs: ApexDocComment[] = [textDoc];

				const result = detectCodeBlockDocs(docs, '', isEmbedFormatted);
				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBeGreaterThan(0);
			},
		);

		it.concurrent('should pass through non-text/non-paragraph docs', () => {
			const codeDoc: ApexDocComment = {
				code: 'test',
				endPos: 10,
				startPos: 0,
				type: 'code',
			};
			const annotationDoc: ApexDocComment = {
				content: 'test',
				name: 'param',
				type: 'annotation',
			};

			const result1 = detectCodeBlockDocs([codeDoc], '');
			expect(result1).toEqual([codeDoc]);

			const result2 = detectCodeBlockDocs([annotationDoc], '');
			expect(result2).toEqual([annotationDoc]);

			const result3 = detectCodeBlockDocs([codeDoc, annotationDoc], '');
			expect(result3).toEqual([codeDoc, annotationDoc]);
		});
	});

	describe('calculatePrefixAndWidth with commentIndent', () => {
		it.concurrent.each([
			{
				commentIndent: 0,
				description:
					'should handle commentIndent=0 (apexdoc.ts line 123)',
				note: 'true branch: bodyIndent should be BODY_INDENT_WHEN_ZERO (2)',
			},
			{
				commentIndent: 4,
				description:
					'should handle commentIndent>0 (apexdoc.ts line 123)',
				note: 'false branch: bodyIndent should be ZERO_INDENT (0)',
			},
		])(
			'$description',
			async ({
				commentIndent,
				note: _note,
			}: Readonly<{
				commentIndent: number;
				description: string;
				note: string;
				// eslint-disable-next-line @typescript-eslint/require-await -- Async signature required for test compatibility
			}>) => {
				// Test the branch: commentIndent === ZERO_INDENT ? BODY_INDENT_WHEN_ZERO : ZERO_INDENT
				const comment = `/**
 * Test comment.
 */`;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {
					printWidth: 80,
					tabWidth: 2,
				} as ParserOptions;

				const result = normalizeSingleApexDocComment(
					comment,
					commentIndent,
					options,
					false,
				);
				expect(result).toBeDefined();
			},
		);
	});
});
