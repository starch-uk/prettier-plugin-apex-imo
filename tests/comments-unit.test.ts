/**
 * @file Unit tests for comments.ts internal functions to reach 100% coverage.
 */

import { describe, it, expect, vi } from 'vitest';
import type { AstPath } from 'prettier';
import type { ParserOptions } from 'prettier';
import type { ApexNode } from '../src/types.js';
import {
	printComment,
	parseCommentToDocs,
	createDocContent,
	normalizeBlockComment,
	normalizeInlineComment,
	normalizeInlineCommentsInCode,
} from '../src/comments.js';

describe('comments internal functions', () => {
	describe('printComment', () => {
		it.concurrent(
			'should return empty string when node is null (line 1065)',
			() => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path for testing
				const mockPath = {
					getNode: (): null => null,
				} as unknown as AstPath<ApexNode>;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for testing
				const options = {
					tabWidth: 2,
					useTabs: false,
				} as ParserOptions;

				const result = printComment(
					mockPath,
					options,
					vi.fn(),
					vi.fn(),
					options,
					vi.fn(() => undefined),
					vi.fn(() => undefined),
				);

				expect(result).toBe('');
			},
		);

		it.concurrent(
			'should return empty string when node does not have value property (line 1065)',
			() => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock node for testing
				const mockNode = {} as unknown as ApexNode;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path for testing
				const mockPath = {
					getNode: (): ApexNode => mockNode,
				} as unknown as AstPath<ApexNode>;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for testing
				const options = {
					tabWidth: 2,
					useTabs: false,
				} as ParserOptions;

				const result = printComment(
					mockPath,
					options,
					vi.fn(),
					vi.fn(),
					options,
					vi.fn(() => undefined),
					vi.fn(() => undefined),
				);

				expect(result).toBe('');
			},
		);

		it.concurrent(
			'should return empty string when node value is not a string (line 1065)',
			() => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock node for testing
				const mockNode = {
					value: 123,
				} as unknown as ApexNode;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path for testing
				const mockPath = {
					getNode: (): ApexNode => mockNode,
				} as unknown as AstPath<ApexNode>;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for testing
				const options = {
					tabWidth: 2,
					useTabs: false,
				} as ParserOptions;

				const result = printComment(
					mockPath,
					options,
					vi.fn(),
					vi.fn(),
					options,
					vi.fn(() => undefined),
					vi.fn(() => undefined),
				);

				expect(result).toBe('');
			},
		);
	});

	describe('parseCommentToDocs', () => {
		it.concurrent(
			'should create text doc when no paragraphs found (lines 734-740)',
			() => {
				// Empty comment with just whitespace - no paragraphs created
				const emptyComment = '/**\n *\n *\n */';
				const result = parseCommentToDocs(emptyComment);
				expect(result).toHaveLength(1);
				expect(result[0]?.type).toBe('text');
			},
		);

		it.concurrent(
			'should handle removeCommentPrefix fallback when regex does not match (line 528)',
			() => {
				// Use removeCommentPrefix directly via parseCommentToDocs with malformed input
				// Line without asterisk pattern when preserveIndent=true
				// This is tested indirectly through parseCommentToDocs
				const comment = '/**\n * normal line\n *   \n */';
				const result = parseCommentToDocs(comment);
				expect(result.length).toBeGreaterThan(0);
			},
		);
	});

	describe('createDocContent', () => {
		it.concurrent('should handle empty lines array (line 552)', () => {
			// Test createDocContent with empty lines array to cover contentToDoc line 552
			// This path is defensive and unlikely in practice but tested for completeness
			const result = createDocContent('text', '', []);
			expect(result.type).toBe('text');
			expect(result.content).toBe('');
			// contentToDoc with empty array returns '' as Doc (line 552)
		});
	});

	describe('normalizeBlockComment', () => {
		it.concurrent(
			'should handle comment with leading whitespace (line 276)',
			() => {
				// Comment with leading whitespace before /*
				const comment = '  /* comment */';
				const result = normalizeBlockComment(comment, 0, {
					tabWidth: 2,
					useTabs: false,
				});
				expect(result).toContain('/*');
				// normalizeCommentStart line 276 should be executed
			},
		);
	});

	describe('normalizeInlineComment', () => {
		it.concurrent.each([
			{
				description:
					'should add space when comment has no space after //',
				expected: '// comment',
				input: '//comment',
			},
			{
				description:
					'should normalize multiple spaces to single space after //',
				expected: '// comment',
				input: '//  comment',
			},
			{
				description: 'should normalize many spaces to single space',
				expected: '// comment',
				input: '//     comment',
			},
			{
				description: 'should preserve comment with single space',
				expected: '// comment',
				input: '// comment',
			},
			{
				description: 'should handle comment with no content (just //)',
				expected: '//',
				input: '//',
			},
			{
				description: 'should handle comment with only space after //',
				expected: '// ',
				input: '// ',
			},
			{
				description: 'should preserve leading whitespace before //',
				expected: '   // comment',
				input: '   //comment',
			},
			{
				description:
					'should preserve leading whitespace and normalize space',
				expected: '   // comment',
				input: '   //  comment',
			},
			{
				description:
					'should handle comment with multiple words and spaces',
				expected: '// comment with spaces',
				input: '//comment with spaces',
			},
			{
				description: 'should handle comment with special characters',
				expected: '// comment with special chars !@#$%',
				input: '//comment with special chars !@#$%',
			},
			{
				description: 'should return non-inline comment as-is',
				expected: '/* block comment */',
				input: '/* block comment */',
			},
			{
				description: 'should return regular text as-is',
				expected: 'regular text',
				input: 'regular text',
			},
		])(
			'$description',
			({
				expected,
				input,
			}: Readonly<{
				description: string;
				expected: string;
				input: string;
			}>) => {
				const result = normalizeInlineComment(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('normalizeInlineCommentsInCode', () => {
		it.concurrent.each([
			{
				description: 'should normalize inline comment on single line',
				expected: 'code; // comment',
				input: 'code; //comment',
			},
			{
				description: 'should normalize inline comment at start of line',
				expected: '// comment',
				input: '//comment',
			},
			{
				description:
					'should normalize multiple inline comments in multiple lines',
				expected: 'code1; // comment1\ncode2; // comment2',
				input: 'code1; //comment1\ncode2; //comment2',
			},
			{
				description: 'should handle lines without comments',
				expected: 'code1;\ncode2;',
				input: 'code1;\ncode2;',
			},
			{
				description:
					'should normalize inline comment with leading whitespace',
				expected: '   code; // comment',
				input: '   code; //comment',
			},
			{
				description:
					'should handle mixed lines with and without comments',
				expected: 'code1;\ncode2; // comment\ncode3;',
				input: 'code1;\ncode2; //comment\ncode3;',
			},
			{
				description: 'should preserve existing single space comments',
				expected: 'code; // comment',
				input: 'code; // comment',
			},
			{
				description:
					'should normalize multiple spaces in inline comment',
				expected: 'code; // comment',
				input: 'code; //  comment',
			},
			{
				description: 'should handle empty lines in code',
				expected: 'code1;\n\ncode2; // comment',
				input: 'code1;\n\ncode2; //comment',
			},
		])(
			'$description',
			({
				expected,
				input,
			}: Readonly<{
				description: string;
				expected: string;
				input: string;
			}>) => {
				const result = normalizeInlineCommentsInCode(input);
				expect(result).toBe(expected);
			},
		);
	});
});
