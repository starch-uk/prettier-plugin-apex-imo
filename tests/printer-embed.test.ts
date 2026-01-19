/**
 * @file Tests for embed function in printer module.
 *
 * Tests the embed function that processes code blocks in comments,
 * specifically testing edge cases like when processAllCodeBlocksInComment
 * returns undefined.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWrappedPrinter } from '../src/printer.js';
import type { ApexNode } from '../src/types.js';
import { setCurrentPluginInstance } from '../src/printer.js';
import { createMockPath, createMockOptions } from './test-utils.js';

// Mock processAllCodeBlocksInComment to control its return value
const { mockProcessAllCodeBlocksInComment } = vi.hoisted(() => ({
	mockProcessAllCodeBlocksInComment: vi.fn(),
}));

vi.mock(import('../src/apexdoc-code.js'), async () => {
	const actual = await vi.importActual<
		// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- import() type is required for typeof import()
		typeof import('../src/apexdoc-code.js')
	>('../src/apexdoc-code.js');
	return {
		...actual,
		// eslint-disable-next-line @typescript-eslint/require-await -- Mock function signature
		processAllCodeBlocksInComment: async (
			...args: Parameters<typeof actual.processAllCodeBlocksInComment>
		): Promise<ReturnType<typeof actual.processAllCodeBlocksInComment>> => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock function return value
			return mockProcessAllCodeBlocksInComment(...args);
		},
	};
});

import { NODE_CLASS_KEY, createMockBlockComment } from './mocks/nodes.js';

const BLOCK_COMMENT_CLASS = 'apex.jorje.parser.impl.HiddenTokens$BlockComment';

describe('printer embed function', () => {
	beforeEach(() => {
		mockProcessAllCodeBlocksInComment.mockClear();
		// Ensure plugin instance is set for most tests
		setCurrentPluginInstance({ default: {} });
	});

	afterEach(() => {
		// Restore plugin instance after each test
		setCurrentPluginInstance({ default: {} });
	});

	describe('when pluginInstance is not set', () => {
		beforeEach(() => {
			// Don't set plugin instance for these tests
			// Reset modules to ensure fresh state
			vi.resetModules();
		});

		afterEach(() => {
			vi.resetModules();
		});

		it('should return undefined when pluginInstance is not set', async () => {
			// Test embed function when pluginInstance is undefined
			const { createWrappedPrinter: createWrappedPrinterFresh } =
				await import('../src/printer.js');
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer for test
			const wrappedFresh = createWrappedPrinterFresh(mockOriginalPrinter);

			const mockNode = createMockBlockComment(
				' * Comment with {@code Integer x = 10;}',
			);
			const mockPath = createMockPath(mockNode);

			// Call embed - pluginInstance should be undefined since we reset modules and didn't set it
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Testing embed property
			const embedResult = wrappedFresh.embed?.(
				mockPath,
				createMockOptions(),
			);
			expect(embedResult).toBeDefined();
			expect(typeof embedResult).toBe('function');

			// Call the async processor - it should return undefined when pluginInstance is undefined
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- Testing async processor
			const docResult = await embedResult?.(async () => 'doc');
			expect(docResult).toBeUndefined();
		});
	});

	it('should add embed function when original printer does not have one', () => {
		// Test that createWrappedPrinter adds embed when original printer lacks it
		const mockOriginalPrinter = {
			print: vi.fn(() => 'original output'),
			// No embed property
		};

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer for test
		const wrapped = createWrappedPrinter(mockOriginalPrinter);

		// Should have embed function
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Testing embed property
		expect(wrapped.embed).toBeDefined();
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Testing embed property
		expect(typeof wrapped.embed).toBe('function');
	});

	it('should return undefined when processAllCodeBlocksInComment returns undefined', async () => {
		// Set plugin instance for embed to work
		setCurrentPluginInstance({ default: {} });
		// Mock processAllCodeBlocksInComment to return undefined
		// This happens when a comment has {@code} but no valid code blocks are processed
		mockProcessAllCodeBlocksInComment.mockResolvedValue(undefined);

		const mockOriginalPrinter = {
			print: vi.fn(() => 'original output'),
		};

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer for test
		const wrapped = createWrappedPrinter(mockOriginalPrinter);

		// Create a comment node with {@code} but malformed blocks
		const mockNode = createMockBlockComment(
			' * This is a comment with {@code but no closing brace',
		);

		const mockPath = createMockPath(mockNode);

		// Call embed function
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Testing embed function
		const embedResult = wrapped.embed?.(mockPath, createMockOptions());

		// embed should return a function (the async processor)
		expect(typeof embedResult).toBe('function');
		expect(embedResult).not.toBeNull();

		// Call the async function
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- Testing async processor
		const docResult = await embedResult?.(async () => 'doc');

		// Should return undefined
		expect(docResult).toBeUndefined();
		expect(mockProcessAllCodeBlocksInComment).toHaveBeenCalled();
	});

	it('should handle comment node with undefined value', () => {
		// Test branch coverage: commentText?.includes() when commentText is undefined
		// This tests the optional chaining branch when commentText is undefined
		setCurrentPluginInstance({ default: {} });

		const mockOriginalPrinter = {
			print: vi.fn(() => 'original output'),
		};

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer for test
		const wrapped = createWrappedPrinter(mockOriginalPrinter);

		// Create a comment node with undefined value
		const mockNode = {
			[NODE_CLASS_KEY]: BLOCK_COMMENT_CLASS,
			value: undefined,
		} as ApexNode;

		const mockPath = createMockPath(mockNode);

		// Call embed function - it should return null because hasCodeTag will be false
		// when value is undefined (commentText?.includes('{@code') ?? false = false)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Testing embed function
		const embedResult = wrapped.embed?.(mockPath, createMockOptions());

		// Since hasCodeTag is false, embed should return null
		expect(embedResult).toBeNull();
	});

	it('should handle options without tabWidth', async () => {
		// Test branch coverage: options.tabWidth ?? DEFAULT_TAB_WIDTH when tabWidth is undefined
		setCurrentPluginInstance({ default: {} });
		mockProcessAllCodeBlocksInComment.mockResolvedValue('formatted code');

		const mockOriginalPrinter = {
			print: vi.fn(() => 'original output'),
		};

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer for test
		const wrapped = createWrappedPrinter(mockOriginalPrinter);

		const mockNode = createMockBlockComment(
			' * Comment with {@code Integer x = 10;}',
		);
		const mockPath = createMockPath(mockNode);

		// Call embed with options that don't include tabWidth to test the ?? DEFAULT_TAB_WIDTH branch
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Testing embed function with mock options
		const embedResult = wrapped.embed?.(
			mockPath,
			// Options without tabWidth to test the ?? DEFAULT_TAB_WIDTH branch
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Testing embed function with mock options
			{ printWidth: 80 } as unknown as ReturnType<
				typeof createMockOptions
			>,
		);

		expect(embedResult).toBeDefined();
		expect(typeof embedResult).toBe('function');

		// Call the async processor - the result should be the formatted code from processAllCodeBlocksInComment
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- Testing async processor
		const docResult = await embedResult?.(async () => 'doc');
		// The embed function should have been called with options that include the default tabWidth
		expect(mockProcessAllCodeBlocksInComment).toHaveBeenCalled();
		// The result should be the formatted code (which is a string, but embed returns it as a Doc)
		expect(docResult).toBeDefined();
	});
});
