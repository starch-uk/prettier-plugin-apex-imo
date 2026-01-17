/**
 * @file Shared test utilities for loading fixtures and creating mocks.
 */

/* eslint-disable import/group-exports -- Multiple named exports are appropriate for utility modules */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Primitives don't need Readonly wrapper */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { vi } from 'vitest';
import type { AstPath, Doc, ParserOptions } from 'prettier';
import type { ApexNode } from '../src/types.js';
import plugin from '../src/index.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads a fixture file for testing.
 * @param name - The name of the fixture directory.
 * @param file - The name of the fixture file. Must be either 'input' or 'output'.
 * @returns The contents of the fixture file.
 * @throws {Error} If the fixture file does not exist or cannot be read.
 * @example
 * ```typescript
 * const content = loadFixture('apexdoc-single-line-code', 'input');
 * ```
 */
export function loadFixture(name: string, file: 'input' | 'output'): string {
	// Validate fixture name to prevent directory traversal
	if (!/^[a-z0-9-]+$/.test(name)) {
		throw new Error(`Invalid fixture name: ${name}`);
	}

	const fixturePath = path.join(
		testDirectory,
		'__fixtures__',
		name,
		`${file}.cls`,
	);

	// Ensure the resolved path is within the test directory to prevent directory traversal
	const resolvedPath = path.resolve(fixturePath);
	const testDirResolved = path.resolve(testDirectory);
	if (!resolvedPath.startsWith(testDirResolved)) {
		throw new Error(`Invalid fixture path: ${name}`);
	}

	try {
		return fs.readFileSync(fixturePath, 'utf-8');
	} catch (error) {
		throw new Error(
			`Failed to load fixture ${name}/${file}.cls: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Formats Apex code using the plugin.
 * @param code - The Apex code to format.
 * @param options - Optional prettier options (defaults to tabWidth: 2).
 * @returns The formatted Apex code.
 * @example
 * ```typescript
 * const formatted = await formatApex('List<Integer> list = new List<Integer>();');
 * ```
 */
export async function formatApex(
	code: Readonly<string>,
	options?: Readonly<Partial<ParserOptions>>,
): Promise<string> {
	return prettier.format(code, {
		parser: 'apex',
		// Only include our plugin - it re-exports everything from prettier-plugin-apex
		plugins: [plugin],
		tabWidth: 2,
		...options,
	});
}

/**
 * Helper function to create type-safe mock path.
 * @param node - The Apex node to create a mock path for.
 * @param key - Optional key for the path.
 * @param stack - Optional stack for the path.
 * @returns A mock AST path for the given node.
 * @example
 * ```typescript
 * const path = createMockPath(mockNode);
 * const pathWithKey = createMockPath(mockNode, 'type');
 * const pathWithStack = createMockPath(mockNode, undefined, [parentNode]);
 * ```
 */
export function createMockPath(
	node: Readonly<ApexNode>,
	key?: number | string,
	stack?: Readonly<readonly unknown[]>,
): AstPath<ApexNode> {
	const stackValue = stack ?? [];
	const mockPath = {
		call: vi.fn(() => ''),
		key,
		map: vi.fn(() => []),
		node,
		stack: stackValue,
	};
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	return mockPath as unknown as AstPath<ApexNode>;
}

/**
 * Helper function to create type-safe mock options.
 * @returns A mock parser options object.
 * @example
 * ```typescript
 * const options = createMockOptions();
 * ```
 */
export function createMockOptions(): Readonly<ParserOptions> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	return {} as Readonly<ParserOptions>;
}

/**
 * Helper function to create type-safe mock print function.
 * @param returnValue - Optional return value for the mock (defaults to 'original output').
 * @returns A mock print function.
 * @example
 * ```typescript
 * const print = createMockPrint();
 * const printWithValue = createMockPrint('custom output');
 * ```
 */
export function createMockPrint(
	returnValue: Readonly<Doc | string> = 'original output',
): (path: Readonly<AstPath<ApexNode>>) => Doc {
	const mockPrint = vi.fn(() => returnValue);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	return mockPrint as (path: Readonly<AstPath<ApexNode>>) => Doc;
}

/**
 * Helper function to create mock original printer.
 * @param returnValue - Optional return value for the mock (defaults to 'original output').
 * @returns A mock original printer object.
 * @example
 * ```typescript
 * const printer = createMockOriginalPrinter();
 * ```
 */
export function createMockOriginalPrinter(
	returnValue: Readonly<Doc | string> = 'original output',
): {
	print: ReturnType<typeof vi.fn>;
} {
	return {
		print: vi.fn(() => returnValue),
	};
}

// Re-export Prettier and prettier-plugin-apex mocks for convenience
export {
	PrettierMockSuite,
	createPrettierMock,
	createMockPrettierPluginApex,
	defaultPrettierMock,
} from './prettier-mock.js';
