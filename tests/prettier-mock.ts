/**
 * @file Reusable Prettier mock suite for testing.
 * Provides comprehensive mocks for Prettier APIs including Doc builders,
 * utilities, format function, and plugin structures that can be imported
 * and used across test modules.
 * @example
 * ```typescript
 * import { PrettierMockSuite } from './prettier-mock.js';
 * const mock = new PrettierMockSuite();
 * vi.mock('prettier', () => mock.getPrettierMock());
 * ```
 */

import { vi } from 'vitest';
import type { AstPath, Doc, ParserOptions, Plugin, Printer } from 'prettier';
import type { ApexNode } from '../src/types.js';

/**
 * Mock implementation of Prettier Doc builders.
 * These functions return their inputs in a simplified form for testing.
 */
class MockDocBuilders {
	/**
	 * Mock softline - returns string marker.
	 */
	public readonly softline = 'softline' as Doc;

	/**
	 * Mock hardline - returns string marker.
	 */
	public readonly hardline = 'hardline' as Doc;

	/**
	 * Mock line - returns string marker.
	 */
	public readonly line = 'line' as Doc;

	/**
	 * Mock group builder - returns array with 'group' marker.
	 * @param doc - The document to wrap in a group.
	 * @returns A Doc array with 'group' marker and the document.
	 */
	public group(doc: Readonly<Doc>): Doc {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		return ['group', doc];
	}

	/**
	 * Mock indent builder - returns array with 'indent' marker.
	 * @param doc - The document to indent, either a single Doc or an array of Docs.
	 * @returns A Doc array with 'indent' marker and the document(s).
	 */
	public indent(doc: Readonly<Doc | Doc[]>): Doc {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		return ['indent', Array.isArray(doc) ? doc : [doc]];
	}

	/**
	 * Mock ifBreak builder - returns array with 'ifBreak' marker.
	 * @param ifBreak - The document to use if line breaks occur.
	 * @param noBreak - The document to use if no line breaks occur (defaults to empty string).
	 * @returns A Doc array with 'ifBreak' marker and the documents.
	 */
	public ifBreak(ifBreak: Readonly<Doc>, noBreak: Readonly<Doc> = ''): Doc {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		return ['ifBreak', ifBreak, noBreak];
	}

	/**
	 * Mock join builder - joins docs with separator.
	 * @param separator - The separator document to insert between docs.
	 * @param docs - The array of documents to join.
	 * @returns A Doc array with 'join' marker, separator, and documents.
	 */
	public join(separator: Readonly<Doc>, docs: Readonly<readonly Doc[]>): Doc {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		return ['join', separator, ...docs];
	}

	/**
	 * Mock fill builder - returns array with 'fill' marker.
	 * @param docs - The array of documents to fill.
	 * @returns A Doc array with 'fill' marker and the documents.
	 */
	public fill(docs: Readonly<readonly Doc[]>): Doc {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		return ['fill', ...docs];
	}
}

/**
 * Mock implementation of Prettier utilities.
 */
class MockPrettierUtil {
	/**
	 * Mock getStringWidth - returns string length.
	 * @param str - The string to measure.
	 * @returns The length of the string.
	 */
	public getStringWidth(str: Readonly<string>): number {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		return str.length;
	}

	/**
	 * Mock skipWhitespace - returns index after whitespace.
	 * @param text - The text to search.
	 * @param startIndex - The starting index.
	 * @returns The index after whitespace characters.
	 */
	public skipWhitespace(text: Readonly<string>, startIndex: number): number {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		let index = startIndex;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- index is checked to be < text.length
		while (index < text.length && /\s/.test(text[index]!)) {
			index++;
		}
		return index;
	}

	/**
	 * Mock getIndentSize - calculates indent size based on leading spaces/tabs.
	 * @param line - The line to measure indent for.
	 * @param _tabWidth - The tab width (unused in mock implementation).
	 * @returns The indent size in characters.
	 */
	public getIndentSize(line: Readonly<string>, _tabWidth: number): number {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		const trimmed = line.trimStart();
		const indent = line.length - trimmed.length;
		return indent;
	}

	/**
	 * Mock addLeadingComment - adds comment before node (no-op implementation).
	 * @param _node - The node to add the comment to (unused in mock).
	 * @param _comment - The comment to add (unused in mock).
	 */
	public addLeadingComment(_node: unknown, _comment: unknown): void {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		// Mock implementation - no-op for testing
	}

	/**
	 * Mock addTrailingComment - adds comment after node (no-op implementation).
	 * @param _node - The node to add the comment to (unused in mock).
	 * @param _comment - The comment to add (unused in mock).
	 */
	public addTrailingComment(_node: unknown, _comment: unknown): void {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		// Mock implementation - no-op for testing
	}

	/**
	 * Mock addDanglingComment - adds dangling comment to node (no-op implementation).
	 * @param _node - The node to add the comment to (unused in mock).
	 * @param _comment - The comment to add (unused in mock).
	 * @param _marker - The comment marker (unused in mock).
	 */
	public addDanglingComment(
		_node: unknown,
		_comment: unknown,
		_marker: unknown,
	): void {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		// Mock implementation - no-op for testing
	}
}

/**
 * Mock implementation of Prettier doc printer.
 */
class MockDocPrinter {
	/**
	 * Mock printDocToString - converts Doc to string representation.
	 * @param doc - The document to convert to string.
	 * @param _options - Optional parser options (unused in mock implementation).
	 * @returns String representation of the document.
	 */
	public printDocToString(
		doc: Readonly<Doc>,
		_options?: Readonly<ParserOptions>,
	): string {
		// Simple stringification for testing
		if (typeof doc === 'string') {
			return doc;
		}
		if (Array.isArray(doc)) {
			// Type assertion needed for array map - elements are Doc type but TypeScript can't infer
			return doc
				.map((d: unknown) =>
					this.printDocToString(d as Readonly<Doc>, _options),
				)
				.join('');
		}
		// For objects, return a placeholder
		return '[Doc]';
	}
}

/**
 * Comprehensive Prettier mock suite for testing.
 *
 * Provides mocks for:
 * - Doc builders (group, indent, softline, etc.)
 * - Prettier utilities (getStringWidth, skipWhitespace, etc.)
 * - format function
 * - doc.printer
 * - Plugin structures.
 */
export class PrettierMockSuite {
	/**
	 * Mock implementation of prettier.format.
	 * Can be customized with custom implementations.
	 */
	public format = vi.fn(
		async (
			code: Readonly<string>,
			_options?: Readonly<
				ParserOptions & { parser?: string; plugins?: unknown[] }
			>,
		): Promise<string> => {
			// Default: return code as-is (identity formatter)
			// eslint-disable-next-line @typescript-eslint/require-await -- Async signature required for mock compatibility
			return code;
		},
	);

	private readonly docBuilders = new MockDocBuilders();
	private readonly util = new MockPrettierUtil();
	private readonly docPrinter = new MockDocPrinter();

	/**
	 * Creates a complete Prettier mock object that can be used with vi.mock.
	 * @param customizations - Optional customizations to override default mocks.
	 * @param customizations.format - Optional custom format function implementation.
	 * @param customizations.doc - Optional doc builders customizations.
	 * @param customizations.doc.builders - Optional doc builder overrides.
	 * @param customizations.util - Optional utility function customizations.
	 * @param customizations.docPrinter - Optional doc printer customizations.
	 * @returns Mock Prettier module object.
	 * @example
	 * ```typescript
	 * const mock = new PrettierMockSuite();
	 * mock.format.mockResolvedValue('formatted code');
	 * vi.mock('prettier', () => mock.getPrettierMock());
	 * ```
	 */
	getPrettierMock(
		customizations?: Readonly<{
			format?: typeof this.format;
			doc?: Readonly<{ builders?: Readonly<Partial<MockDocBuilders>> }>;
			util?: Readonly<Partial<MockPrettierUtil>>;
			docPrinter?: Readonly<Partial<MockDocPrinter>>;
		}>,
	): typeof import('prettier') {
		const customDocBuilders = {
			...this.docBuilders,
			...(customizations?.doc?.builders ?? {}),
		};

		const customUtil = {
			...this.util,
			...(customizations?.util ?? {}),
		};

		const customDocPrinter = {
			...this.docPrinter,
			...(customizations?.docPrinter ?? {}),
		};

		return {
			doc: {
				builders: customDocBuilders,
				printer: customDocPrinter,
			},
			format: customizations?.format ?? this.format,
			util: customUtil,
		} as unknown as typeof import('prettier');
	}

	/**
	 * Creates a mock Prettier plugin structure.
	 * @param overrides - Optional overrides for default plugin structure.
	 * @returns Mock plugin object.
	 * @example
	 * ```typescript
	 * const mock = new PrettierMockSuite();
	 * const plugin = mock.createMockPlugin({
	 *   printers: { apex: { print: vi.fn() } }
	 * });
	 * ```
	 */
	createMockPlugin(
		overrides?: Readonly<Partial<Plugin<ApexNode>>>,
	): Plugin<ApexNode> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock type assertion for test utilities
		return {
			defaultOptions: {},
			languages: [],
			options: {},
			parsers: {},
			printers: {},
			...overrides,
		} as Plugin<ApexNode>;
	}

	/**
	 * Creates a mock printer object.
	 * @param printImplementation - Optional custom print function.
	 * @returns Mock printer object.
	 */
	createMockPrinter(
		printImplementation?: Readonly<
			(
				path: Readonly<AstPath<ApexNode>>,
				options: Readonly<ParserOptions>,
				print: (path: Readonly<AstPath<ApexNode>>) => Doc,
			) => Doc
		>,
	): Printer<ApexNode> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock type assertion for test utilities
		return {
			print: printImplementation ?? vi.fn(() => 'mock output'),
		} as Printer<ApexNode>;
	}

	/**
	 * Gets the mock Doc builders.
	 * Useful for accessing builders directly in tests.
	 */
	getDocBuilders(): MockDocBuilders {
		return this.docBuilders;
	}

	/**
	 * Gets the mock Prettier utilities.
	 * Useful for accessing utilities directly in tests.
	 */
	getUtil(): MockPrettierUtil {
		return this.util;
	}

	/**
	 * Gets the mock doc printer.
	 * Useful for accessing doc printer directly in tests.
	 */
	getDocPrinter(): MockDocPrinter {
		return this.docPrinter;
	}

	/**
	 * Resets all mocks to their initial state.
	 * Useful in beforeEach/afterEach hooks.
	 */
	resetMocks(): void {
		this.format.mockClear();
	}
}

/**
 * Default instance of PrettierMockSuite for convenience.
 * Can be imported directly for quick access.
 *
 * Helper to create a mock Prettier module with custom format implementation.
 * @param options - Optional configuration options.
 * @param options.format - Custom format function implementation.
 * @returns Mock Prettier module.
 * @example
 * ```typescript
 * vi.mock('prettier', () => createPrettierMock({
 *   format: vi.fn().mockResolvedValue('formatted')
 * }));
 * ```
 */
export const defaultPrettierMock = new PrettierMockSuite();
export function createPrettierMock(
	options?: Readonly<{
		format?: (
			code: string,
			opts?: Readonly<
				ParserOptions & { parser?: string; plugins?: unknown[] }
			>,
		) => Promise<string>;
	}>,
): typeof import('prettier') {
	const suite = new PrettierMockSuite();
	if (options?.format) {
		suite.format = options.format;
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock type assertion for test utilities
	return suite.getPrettierMock() as typeof import('prettier');
}
