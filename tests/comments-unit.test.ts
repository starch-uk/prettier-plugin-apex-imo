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
} from '../src/comments.js';
import type { ParserOptions } from 'prettier';
import { docBuilders } from '../src/utils.js';

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

});
