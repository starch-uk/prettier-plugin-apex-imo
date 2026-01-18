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
				description: 'single-line comment',
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

	describe('normalizeSingleApexDocComment', () => {
		it.concurrent.each([
			{
				commentIndent: 0,
				description:
					'should handle commentIndent=0 with isEmbedFormatted=true',
				isEmbedFormatted: true,
			},
			{
				commentIndent: 0,
				description:
					'should handle commentIndent=0 with isEmbedFormatted=false',
				isEmbedFormatted: false,
			},
			{
				commentIndent: 4,
				description:
					'should handle commentIndent>0 with isEmbedFormatted=true',
				isEmbedFormatted: true,
			},
			{
				commentIndent: 4,
				description:
					'should handle commentIndent>0 with isEmbedFormatted=false',
				isEmbedFormatted: false,
			},
		])(
			'$description',
			async ({
				commentIndent,
				isEmbedFormatted,
			}: Readonly<{
				commentIndent: number;
				description: string;
				isEmbedFormatted: boolean;
				// eslint-disable-next-line @typescript-eslint/require-await -- Async signature required for test compatibility
			}>) => {
				const comment = `/**
 * Test comment.
 * {@code Integer x = 10; }
 */`;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				const options = {
					printWidth: 80,
					tabWidth: 2,
				} as ParserOptions;

				const normalizeResult = normalizeSingleApexDocComment(
					comment,
					commentIndent,
					options,
					isEmbedFormatted,
				);
				expect(normalizeResult).toBeDefined();
			},
		);

		describe('detectCodeBlockDocs with isEmbedFormatted', () => {
			it.concurrent.each([
				{
					description:
						'should handle isEmbedFormatted=true for code blocks',
					isEmbedFormatted: true,
				},
				{
					description:
						'should handle isEmbedFormatted=false for code blocks',
					isEmbedFormatted: false,
				},
			])(
				'$description',
				({
					isEmbedFormatted,
				}: Readonly<{
					description: string;
					isEmbedFormatted: boolean;
				}>) => {
					// Test detectCodeBlockDocs with isEmbedFormatted parameter
					const textDoc = createDocContent(
						'text',
						'Example with {@code Integer x = 10; } code block',
						['Example with {@code Integer x = 10; } code block'],
					);
					const docs: ApexDocComment[] = [textDoc];

					const detectResult = detectCodeBlockDocs(
						docs,
						'',
						isEmbedFormatted,
					);
					expect(Array.isArray(detectResult)).toBe(true);
					expect(detectResult.length).toBeGreaterThan(0);
				},
			);
		});
	});

	describe('detectCodeBlockDocs', () => {
		it.concurrent(
			'should pass through non-text/non-paragraph docs unchanged in detectCodeBlockDocs',
			() => {
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

				const result3 = detectCodeBlockDocs(
					[codeDoc, annotationDoc],
					'',
				);
				expect(result3).toEqual([codeDoc, annotationDoc]);
			},
		);
	});
});
