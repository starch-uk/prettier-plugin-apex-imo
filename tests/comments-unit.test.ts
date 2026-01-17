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
} from '../src/comments.js';

describe('comments internal functions', () => {
	describe('printComment', () => {
		it.concurrent('should return empty string when node is null', () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path for test
			const mockPath = {
				getNode: (): null => null,
			} as unknown as AstPath<ApexNode>;

			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
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
		});

		it.concurrent(
			'should return empty string when node does not have value property',
			() => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock node for test
				const mockNode = {} as unknown as ApexNode;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path for test
				const mockPath = {
					getNode: (): ApexNode => mockNode,
				} as unknown as AstPath<ApexNode>;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
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
			'should return empty string when node value is not a string',
			() => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock node for test
				const mockNode = {
					value: 123,
				} as unknown as ApexNode;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path for test
				const mockPath = {
					getNode: (): ApexNode => mockNode,
				} as unknown as AstPath<ApexNode>;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
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
		it.concurrent('should create text doc when no paragraphs found', () => {
			// Empty comment with just whitespace - no paragraphs created
			const emptyComment = '/**\n *\n *\n */';
			const result = parseCommentToDocs(emptyComment);
			expect(result).toHaveLength(1);
			expect(result[0]?.type).toBe('text');
		});

		it.concurrent(
			'should handle removeCommentPrefix fallback when regex does not match',
			() => {
				// Use removeCommentPrefix directly via parseCommentToDocs with malformed input
				// Line without asterisk pattern when preserveIndent=true
				const comment = '/**\n * normal line\n *   \n */';
				const result = parseCommentToDocs(comment);
				expect(result.length).toBeGreaterThan(0);
			},
		);
	});

	describe('createDocContent', () => {
		it.concurrent('should handle empty lines array', () => {
			// Test createDocContent with empty lines array
			// This path is defensive and unlikely in practice but tested for completeness
			const result = createDocContent('text', '', []);
			expect(result.type).toBe('text');
			expect(result.content).toBe('');
		});
	});
});
