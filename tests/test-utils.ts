/**
 * @file Shared test utilities for loading fixtures and creating mocks.
 */

/* eslint-disable import/group-exports -- Multiple named exports are appropriate for utility modules */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Primitives don't need Readonly wrapper */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { expect, vi } from 'vitest';
import type { AstPath, Doc, ParserOptions } from 'prettier';
import type { ApexDocComment } from '../src/comments.js';
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

/**
 * Helper to extract comment value from fixture text.
 * @param text - The fixture text containing a comment.
 * @returns The extracted comment value (from comment start to end markers).
 * @throws {Error} If comment markers are not found in the fixture.
 * @example
 * ```typescript
 * const comment = extractComment('  /' + '* *\n   * Test\n   * /');
 * ```
 */
export function extractComment(text: string): string {
	const startRegex = /\/\*\*/;
	const endRegex = /\*\//;
	const startMatch = startRegex.exec(text);
	const endMatch = endRegex.exec(text);
	if (startMatch?.index === undefined || endMatch?.index === undefined) {
		throw new Error('Could not find comment in fixture');
	}
	return text.substring(startMatch.index, endMatch.index + 2);
}

/**
 * Helper to extract comment indent from fixture text.
 * @param text - The fixture text containing a comment.
 * @returns The comment indent level (number of spaces before comment start).
 * @example
 * ```typescript
 * const indent = extractCommentIndent('    /' + '* *\n     * Test\n     * /');
 * // Returns 4
 * ```
 */
export function extractCommentIndent(text: string): number {
	const startRegex = /^(\s*)\/\*\*/m;
	const startMatch = startRegex.exec(text);
	if (startMatch?.[1] === undefined) {
		return 0;
	}
	// Count spaces (assuming 2 spaces per indent level in fixtures)
	return startMatch[1].length;
}

/**
 * Extracts the code block content from a formatted ApexDoc comment result.
 * Handles both single-line and multi-line code blocks (using ApexDoc code block syntax).
 * @param result - The formatted ApexDoc comment result containing code block.
 * @returns The extracted code block content.
 * @throws {Error} If the code block cannot be found or extracted.
 * @example
 * ```typescript
 * const code = extractCodeBlockFromResult('...ApexDoc comment with code block...');
 * ```
 */
export function extractCodeBlockFromResult(result: string): string {
	const NOT_FOUND_INDEX = -1;
	const CODE_TAG_LENGTH = 6;
	const codeBlockStart = result.indexOf('{@code');
	if (codeBlockStart === NOT_FOUND_INDEX) {
		throw new Error(`Could not find {@code} block in result: ${result}`);
	}

	// Find the content after {@code (skip whitespace and newline)
	let contentStart = codeBlockStart + CODE_TAG_LENGTH;
	while (
		contentStart < result.length &&
		(result[contentStart] === ' ' || result[contentStart] === '\n')
	) {
		contentStart++;
	}

	// Check if this is a single-line code block: {@code ...} or {@code ...; }
	const remainingText = result.slice(contentStart);
	const lines = remainingText.split('\n');
	const ARRAY_START_INDEX = 0;
	const EMPTY_LINE_LENGTH = 0;

	// First, check if this is a single-line code block
	const firstLine = lines[ARRAY_START_INDEX] ?? '';
	const singleLineMatch = /^(.+?)\s*\}\s*$/.exec(firstLine);
	if (singleLineMatch && !firstLine.includes('\n')) {
		// Single-line code block - extract content directly
		const codeBlockContent = singleLineMatch[1]?.trimEnd() ?? '';
		const ZERO_LENGTH = 0;
		if (codeBlockContent.length > ZERO_LENGTH) {
			return codeBlockContent;
		}
		throw new Error(`Code block content is empty in result: ${result}`);
	}

	// Multiline format: find the closing } that's on a line with just whitespace, asterisk, space, and }
	let closingLineIndex = NOT_FOUND_INDEX;
	for (let i = lines.length - 1; i >= EMPTY_LINE_LENGTH; i--) {
		const line = lines[i];
		// Match line with just whitespace, asterisk, space, and } (not };)
		if (/^\s*\*\s*\}$/.test(line)) {
			closingLineIndex = i;
			break;
		}
	}
	if (closingLineIndex === NOT_FOUND_INDEX) {
		throw new Error(
			`Could not find closing } for {@code} block in result: ${result}`,
		);
	}

	// Get all lines up to (but not including) the closing line
	const codeBlockLines = lines.slice(ARRAY_START_INDEX, closingLineIndex);
	const codeBlockContent = codeBlockLines.join('\n');
	const ZERO_LENGTH = 0;
	if (codeBlockContent.length > ZERO_LENGTH) {
		// Remove comment prefixes (like "   * ") from each line
		const codeLines = codeBlockContent
			.split('\n')
			.map((line) => line.replace(/^\s*\*\s?/, '').trimEnd())
			.filter(
				(line) =>
					line.length > ZERO_LENGTH ||
					codeBlockContent.includes('\n'),
			);
		return codeLines.join('\n').trim();
	}
	throw new Error(`Code block content is empty in result: ${result}`);
}

/**
 * Helper to test that transformation functions pass through certain doc types unchanged.
 * @param transformFn - The transformation function to test.
 * @param inputDocs - The input docs to transform.
 * @param args - Additional arguments to pass to the transformation function.
 * @example
 * ```typescript
 * expectDocsUnchanged(detectCodeBlockDocs, [codeDoc], '');
 * ```
 */
export function expectDocsUnchanged(
	transformFn: (...args: unknown[]) => readonly ApexDocComment[],
	inputDocs: readonly ApexDocComment[],
	...args: unknown[]
): void {
	const result = transformFn(inputDocs, ...args);
	expect(result).toEqual(inputDocs);
}

// Re-export Prettier and prettier-plugin-apex mocks for convenience
export {
	PrettierMockSuite,
	createPrettierMock,
	createMockPrettierPluginApex,
	defaultPrettierMock,
} from './prettier-mock.js';
