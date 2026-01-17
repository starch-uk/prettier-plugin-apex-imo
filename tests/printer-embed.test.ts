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
const mockProcessAllCodeBlocksInComment = vi.fn();
vi.mock('../src/apexdoc-code.js', async () => {
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

const nodeClassKey = '@class';
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

	it('should return undefined when pluginInstance is not set', async () => {
		// Test embed function when pluginInstance is null/undefined
		// Clear plugin instance to test the null/undefined check
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion -- Need to set to undefined for test
		setCurrentPluginInstance(undefined as any);
		// Reset it by calling getCurrentPluginInstance which might return undefined now
		// Actually, we need to clear the module-level variable
		// The test needs to ensure getCurrentPluginInstance returns null/undefined

		const mockOriginalPrinter = {
			print: vi.fn(() => 'original output'),
		};

		// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment -- wrapped is used indirectly through mock
		const wrapped = createWrappedPrinter(mockOriginalPrinter);

		const mockNode = {
			[nodeClassKey]: BLOCK_COMMENT_CLASS,
			value: ' * Comment with {@code Integer x = 10;}',
		} as ApexNode;

		const mockPath = createMockPath(mockNode);

		// Mock getCurrentPluginInstance to return undefined
		// We can't directly mock module-level functions, so we need to use a different approach
		// Since getCurrentPluginInstance just returns currentPluginInstance, we need to clear it
		// But setCurrentPluginInstance expects an object, so we need to access the module directly
		// For now, let's try clearing it and see if that works
		// Actually, let's test by ensuring the function is called when pluginInstance might be undefined
		// The best way is to temporarily not set it, but we need to ensure it's actually undefined
		// Since the beforeEach sets it, we need to clear it after beforeEach runs
		// But we can't control beforeEach order easily, so let's mock the module
		vi.doMock('../src/printer.js', async () => {
			const actual = await vi.importActual<
				// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- import() type is required for typeof import()
				typeof import('../src/printer.js')
			>('../src/printer.js');
			return {
				...actual,
				getCurrentPluginInstance: vi.fn(() => undefined),
			};
		});

		// Reset modules to ensure fresh import
		vi.resetModules();

		// Import the module again to get the mocked version
		const { createWrappedPrinter: createWrappedPrinterMocked } =
			await import('../src/printer.js');
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer for test
		const wrappedMocked = createWrappedPrinterMocked(mockOriginalPrinter);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Testing embed property
		const embedResult = wrappedMocked.embed?.(
			mockPath,
			createMockOptions(),
		);
		// embedResult should be a function (the async processor)
		expect(embedResult).toBeDefined();
		expect(typeof embedResult).toBe('function');

		// Call the async processor - it should return undefined when pluginInstance is null
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- Testing async processor
		const docResult = await embedResult?.(async () => 'doc');
		expect(docResult).toBeUndefined();

		// Restore module
		vi.doUnmock('../src/printer.js');
		vi.resetModules();
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
		const mockNode = {
			[nodeClassKey]: BLOCK_COMMENT_CLASS,
			value: ' * This is a comment with {@code but no closing brace',
		} as ApexNode;

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
		// This tests the optional chaining branch on line 231 in printer.ts
		setCurrentPluginInstance({ default: {} });

		const mockOriginalPrinter = {
			print: vi.fn(() => 'original output'),
		};

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer for test
		const wrapped = createWrappedPrinter(mockOriginalPrinter);

		// Create a comment node with undefined value
		const mockNode = {
			[nodeClassKey]: BLOCK_COMMENT_CLASS,
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
});
