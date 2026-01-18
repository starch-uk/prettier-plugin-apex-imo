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

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Mock utilities need mutable parameters to match Prettier API signatures */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Mock implementations require unsafe assignments for testing */
/* eslint-disable @typescript-eslint/no-misused-spread -- Spread operator needed for mock customization */
/* eslint-disable @typescript-eslint/consistent-type-imports -- import() type is required for typeof import() */
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
	public group(doc: Doc): Doc {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		return ['group', doc];
	}

	/**
	 * Mock indent builder - returns array with 'indent' marker.
	 * @param doc - The document to indent, either a single Doc or an array of Docs.
	 * @returns A Doc array with 'indent' marker and the document(s).
	 */
	public indent(doc: Doc | Doc[]): Doc {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		return ['indent', Array.isArray(doc) ? doc : [doc]];
	}

	/**
	 * Mock ifBreak builder - returns array with 'ifBreak' marker.
	 * @param ifBreak - The document to use if line breaks occur.
	 * @param noBreak - The document to use if no line breaks occur (defaults to empty string).
	 * @returns A Doc array with 'ifBreak' marker and the documents.
	 */
	public ifBreak(ifBreak: Doc, noBreak: Doc = ''): Doc {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		return ['ifBreak', ifBreak, noBreak];
	}

	/**
	 * Mock join builder - joins docs with separator.
	 * @param separator - The separator document to insert between docs.
	 * @param docs - The array of documents to join.
	 * @returns A Doc array with 'join' marker, separator, and documents.
	 */
	public join(separator: Doc, docs: readonly Doc[]): Doc {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		return ['join', separator, ...docs];
	}

	/**
	 * Mock fill builder - returns array with 'fill' marker.
	 * @param docs - The array of documents to fill.
	 * @returns A Doc array with 'fill' marker and the documents.
	 */
	public fill(docs: readonly Doc[]): Doc {
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
	 * @param str - The string to measure width of.
	 * @returns The width/length of the string.
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
	 * @returns The number of leading whitespace characters.
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
		doc: Doc,
		_options?: Readonly<ParserOptions>,
	): string {
		// Simple stringification for testing
		if (typeof doc === 'string') {
			return doc;
		}
		if (Array.isArray(doc)) {
			// Type assertion needed for array map - elements are Doc type but TypeScript can't infer
			return doc
				.map((d: unknown) => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Array elements may be any Doc type in mock implementation
					return this.printDocToString(d as Doc, _options);
				})
				.join('');
		}
		// For objects, return a placeholder
		return '[Doc]';
	}
}

/**
 * Default instance of PrettierMockSuite for convenience.
 * Can be imported directly for quick access.
 *
 * Helper to create a mock Prettier module with custom format implementation.
 * @param options - Optional configuration options.
 * @param options.format - Custom format function implementation.
 * @param options.format.code - The code to format.
 * @param options.format.opts - Optional parser options.
 * @returns Mock Prettier module.
 * @example
 * ```typescript
 * vi.mock('prettier', () => createPrettierMock({
 *   format: vi.fn().mockResolvedValue('formatted')
 * }));
 * ```
 */

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
class PrettierMockSuite {
	/**
	 * Mock implementation of prettier.format.
	 * Can be customized with custom implementations.
	 */
	public format = vi.fn(
		async (
			code: string,
			_options?: Readonly<
				ParserOptions & { parser?: string; plugins?: unknown[] }
			>,
			// eslint-disable-next-line @typescript-eslint/require-await -- Async signature required for mock compatibility
		): Promise<string> => {
			// Default: return code as-is (identity formatter)
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
	public getPrettierMock(
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

		const format = customizations?.format ?? this.format;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock implementation requires type assertion for testing
		return {
			doc: {
				builders: customDocBuilders,
				printer: customDocPrinter,
			},
			format,
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
	public createMockPlugin(
		overrides?: Readonly<Partial<Plugin<ApexNode>>>,
	): Plugin<ApexNode> {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
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
	public createMockPrinter(
		printImplementation?: Readonly<
			(
				path: AstPath<ApexNode>,
				options: ParserOptions,
				print: (path: AstPath<ApexNode>) => Doc,
			) => Doc
		>,
	): Printer<ApexNode> {
		void this; // Satisfy class-methods-use-this (method kept as instance for mock API compatibility)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock type assertion for test utilities
		return {
			print: printImplementation ?? vi.fn(() => 'mock output'),
		} as Printer<ApexNode>;
	}

	/**
	 * Gets the mock Doc builders.
	 * Useful for accessing builders directly in tests.
	 * @returns The mock Doc builders instance.
	 */
	public getDocBuilders(): MockDocBuilders {
		return this.docBuilders;
	}

	/**
	 * Gets the mock Prettier utilities.
	 * Useful for accessing utilities directly in tests.
	 * @returns The mock Prettier utilities instance.
	 */
	public getUtil(): MockPrettierUtil {
		return this.util;
	}

	/**
	 * Gets the mock doc printer.
	 * Useful for accessing doc printer directly in tests.
	 * @returns The mock doc printer instance.
	 */
	public getDocPrinter(): MockDocPrinter {
		return this.docPrinter;
	}

	/**
	 * Resets all mocks to their initial state.
	 * Useful in beforeEach/afterEach hooks.
	 */
	public resetMocks(): void {
		this.format.mockClear();
	}
}

/**
 * Default instance of PrettierMockSuite for convenience.
 * Can be imported directly for quick access.
 */
const defaultPrettierMock = new PrettierMockSuite();

/**
 * Helper to create a mock Prettier module with custom format implementation.
 * @param options - Optional configuration options.
 * @param options.format - Custom format function implementation, or a factory function that creates a fresh mock for concurrent testing.
 * @param options.format.code - The code to format.
 * @param options.format.opts - Optional parser options.
 * @returns Mock Prettier module.
 * @example
 * ```typescript
 * vi.mock('prettier', () => createPrettierMock({
 *   format: vi.fn().mockResolvedValue('formatted')
 * }));
 * ```
 * @example
 * ```typescript
 * // For concurrent testing, use a factory function
 * vi.mock('prettier', () => createPrettierMock({
 *   format: () => vi.fn().mockResolvedValue('formatted')
 * }));
 * ```
 */
function createPrettierMock(
	options?: Readonly<{
		format?:
			| ((
					code: string,
					opts?: Readonly<
						ParserOptions & { parser?: string; plugins?: unknown[] }
					>,
			  ) => Promise<string>)
			| (() => ReturnType<typeof vi.fn>);
	}>,
): typeof import('prettier') {
	const suite = new PrettierMockSuite();
	if (options?.format) {
		// Check if format is a factory function (no parameters) or a direct implementation
		if (options.format.length === 0) {
			// Factory function - call it to create a fresh mock
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Factory function type assertion for testing
			suite.format = (options.format as () => ReturnType<typeof vi.fn>)();
		} else {
			// Direct implementation
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Direct implementation type assertion for testing
			suite.format = options.format as typeof suite.format;
		}
	}
	return suite.getPrettierMock();
}

/**
 * Shape of the default export of prettier-plugin-apex.
 */
interface PrettierPluginApexDefault {
	defaultOptions: object;
	languages: unknown[];
	options: object;
	parsers: object;
	printers: unknown;
}

/**
 * Shape of the prettier-plugin-apex module (default and named exports).
 */
interface PrettierPluginApexModule {
	default: PrettierPluginApexDefault;
	defaultOptions: object;
	languages: unknown[];
	options: object;
	parsers: object;
	printers: unknown;
}

/**
 * Creates a mock for the prettier-plugin-apex module for use with vi.doMock or vi.mock.
 * Matches the shape consumed by src/index (default and named exports).
 * @param overrides - Optional overrides for defaultOptions, languages, options, parsers, printers.
 * @returns Mock module object.
 * @example
 * ```typescript
 * vi.doMock('prettier-plugin-apex', () => createMockPrettierPluginApex({ printers: undefined }));
 * vi.resetModules();
 * await import('../src/index.js'); // throws when printers is missing
 * ```
 */
function createMockPrettierPluginApex(
	overrides?: Readonly<Partial<PrettierPluginApexDefault>>,
): PrettierPluginApexModule {
	const base = {
		defaultOptions: {},
		languages: [],
		options: {},
		parsers: {},
		printers: undefined as unknown,
	};
	const merged = { ...base, ...overrides };
	return { default: merged, ...merged };
}

// Export all functions and constants in a single export declaration
export {
	PrettierMockSuite,
	createMockPrettierPluginApex,
	createPrettierMock,
	defaultPrettierMock,
};
