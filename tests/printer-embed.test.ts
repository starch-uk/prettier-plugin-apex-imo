/**
 * @file Tests for embed function in printer module.
 *
 * Tests the embed function that processes {@code} blocks in comments,
 * specifically testing edge cases like when processAllCodeBlocksInComment
 * returns undefined.
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/prefer-readonly-parameter-types */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrappedPrinter } from '../src/printer.js';
import type { ApexNode } from '../src/types.js';
import {
	createMockPath,
	createMockOptions,
} from './test-utils.js';
import { setCurrentPluginInstance } from '../src/printer.js';

// Mock processAllCodeBlocksInComment to control its return value
const mockProcessAllCodeBlocksInComment = vi.fn();
vi.mock('../src/apexdoc-code.js', async () => {
	const actual = await vi.importActual<typeof import('../src/apexdoc-code.js')>(
		'../src/apexdoc-code.js',
	);
	return {
		...actual,
		processAllCodeBlocksInComment: (
			...args: Parameters<typeof actual.processAllCodeBlocksInComment>
		) => mockProcessAllCodeBlocksInComment(...args),
	};
});

const nodeClassKey = '@class';
const BLOCK_COMMENT_CLASS =
	'apex.jorje.parser.impl.HiddenTokens$BlockComment';

describe('printer embed function', () => {
	beforeEach(() => {
		mockProcessAllCodeBlocksInComment.mockClear();
		// Set plugin instance for embed to work
		setCurrentPluginInstance({ default: {} });
	});

	it('should return undefined when processAllCodeBlocksInComment returns undefined (line 254)', async () => {
		// Mock processAllCodeBlocksInComment to return undefined
		// This happens when a comment has {@code} but no valid code blocks are processed
		mockProcessAllCodeBlocksInComment.mockResolvedValue(undefined);

		const mockOriginalPrinter = {
			print: vi.fn(() => 'original output'),
		};

		const wrapped = createWrappedPrinter(mockOriginalPrinter);

		// Create a comment node with {@code} but malformed blocks
		const mockNode = {
			[nodeClassKey]: BLOCK_COMMENT_CLASS,
			value: ' * This is a comment with {@code but no closing brace',
		} as ApexNode;

		const mockPath = createMockPath(mockNode);

		// Call embed function
		const embedResult = wrapped.embed?.(mockPath, createMockOptions());

		// embed should return a function (the async processor)
		expect(typeof embedResult).toBe('function');
		expect(embedResult).not.toBeNull();

		// Call the async function
		const docResult = await embedResult?.(async () => 'doc');

		// Should return undefined (line 254)
		expect(docResult).toBeUndefined();
		expect(mockProcessAllCodeBlocksInComment).toHaveBeenCalled();
	});
});
