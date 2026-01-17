/**
 * @file Unit tests for comments.ts internal functions to reach 100% coverage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AstPath } from 'prettier';
import type { ApexNode } from '../src/types.js';
import {
	printComment,
	tokensToCommentString,
	parseCommentToDocs,
	createDocContent,
	normalizeBlockComment,
	handleOwnLineComment,
} from '../src/comments.js';
import type { ParserOptions } from 'prettier';
import { docBuilders } from '../src/utils.js';
import { PrettierMockSuite } from './prettier-mock.js';
import { vi, beforeEach } from 'vitest';

describe('comments internal functions', () => {
	describe('printComment', () => {
		it.concurrent(
			'should return empty string when node is null (line 1065)',
			() => {
				const mockPath = {
					getNode: (): null => null,
				} as unknown as AstPath<ApexNode>;

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
				const mockNode = {} as unknown as ApexNode;
				const mockPath = {
					getNode: (): ApexNode => mockNode,
				} as unknown as AstPath<ApexNode>;

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
				const mockNode = {
					value: 123,
				} as unknown as ApexNode;
				const mockPath = {
					getNode: (): ApexNode => mockNode,
				} as unknown as AstPath<ApexNode>;

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
});
