/**
 * @file Printer mock factories for testing.
 * Provides reusable printer mock configurations.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Mock factories for testing don't require strict readonly parameters */
import { vi } from 'vitest';
import type { AstPath, Doc, ParserOptions, Printer } from 'prettier';
import type { ApexNode } from '../../src/types.js';

/**
 * Creates a mock print function for testing.
 * @param returnValue - Optional Doc or string value the mock should return (defaults to 'original output').
 * @returns A mock print function that returns the specified value.
 * @example
 * ```typescript
 * const print = createMockPrint();
 * const printWithValue = createMockPrint('custom output');
 * ```
 */
function createMockPrint(
	returnValue: Readonly<Doc | string> = 'original output',
): (path: Readonly<AstPath<ApexNode>>) => Doc {
	const mockPrint = vi.fn(() => returnValue);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock factory for testing
	return mockPrint as (path: Readonly<AstPath<ApexNode>>) => Doc;
}

/**
 * Creates a mock original printer for testing.
 * @param returnValue - Optional Doc or string value the mock should return (defaults to 'original output').
 * @returns A mock printer object with a print method that returns the specified value.
 * @example
 * ```typescript
 * const printer = createMockOriginalPrinter();
 * ```
 */
function createMockOriginalPrinter(
	returnValue: Readonly<Doc | string> = 'original output',
): {
	print: ReturnType<typeof vi.fn>;
} {
	return {
		print: vi.fn(() => returnValue),
	};
}

/**
 * Creates a mock printer with custom print implementation for testing.
 * @param printImplementation - Optional custom print function to use in the mock printer.
 * @returns A mock printer object with the specified or default print implementation.
 */
function createMockPrinter(
	printImplementation?: (
		path: AstPath<ApexNode>,
		options: ParserOptions,
		print: (path: AstPath<ApexNode>) => Doc,
	) => Doc,
): Printer<ApexNode> {
	return {
		print: printImplementation ?? vi.fn(() => 'mock output'),
	} as Printer<ApexNode>;
}

// Export all functions in a single export declaration
export { createMockOriginalPrinter, createMockPrint, createMockPrinter };
