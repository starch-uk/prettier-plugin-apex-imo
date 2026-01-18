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

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- Mock implementations require type assertions for testing */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Mock utilities need mutable parameters to match Prettier API signatures */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Mock implementations require unsafe assignments for testing */
/* eslint-disable @typescript-eslint/no-misused-spread -- Spread operator needed for mock customization */
/* eslint-disable @typescript-eslint/consistent-type-imports -- import() type is required for typeof import() */
/* eslint-disable @typescript-eslint/promise-function-async -- Mock format function signature must match Prettier API */
/* eslint-disable jsdoc/require-returns -- Mock implementations have simple return descriptions */
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
	 * @param doc - The document to group.
	 * @returns Grouped document.
	 */
	public static group(doc: Doc): Doc {
		return ['group', doc];
	}

	/**
	 * Mock indent builder - returns array with 'indent' marker.
	 * @param doc - The document to indent.
	 * @returns Indented document.
	 */
	public static indent(doc: Doc | Doc[]): Doc {
		return ['indent', Array.isArray(doc) ? doc : [doc]];
	}

	/**
	 * Mock ifBreak builder - returns array with 'ifBreak' marker.
	 * @param ifBreak - Document to use if break occurs.
	 * @param noBreak - Document to use if no break occurs.
	 * @returns IfBreak document.
	 */
	public static ifBreak(ifBreak: Doc, noBreak: Doc = ''): Doc {
		return ['ifBreak', ifBreak, noBreak];
	}

	/**
	 * Mock join builder - joins docs with separator.
	 * @param separator - Separator document.
	 * @param docs - Documents to join.
	 * @returns Joined document.
	 */
	public static join(separator: Doc, docs: readonly Doc[]): Doc {
		return ['join', separator, ...docs];
	}

	/**
	 * Mock fill builder - returns array with 'fill' marker.
	 * @param docs - Documents to fill.
	 * @returns Fill document.
	 */
	public static fill(docs: readonly Doc[]): Doc {
		return ['fill', ...docs];
	}
}

/**
 * Mock implementation of Prettier utilities.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Mock class needed for type compatibility
class MockPrettierUtil {
	/**
	 * Mock getStringWidth - returns string length.
	 * @param str - String to measure.
	 * @returns The length of the string as its width.
	 */
	public static getStringWidth(str: string): number {
		return str.length;
	}

	/**
	 * Mock skipWhitespace - returns index after whitespace.
	 * @param text - Text to search.
	 * @param startIndex - Starting index.
	 * @returns Index after whitespace.
	 */
	public static skipWhitespace(text: string, startIndex: number): number {
		let index = startIndex;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Index is validated by loop condition
		while (index < text.length && /\s/.test(text[index]!)) {
			index++;
		}
		return index;
	}

	/**
	 * Mock getIndentSize - calculates indent size based on leading spaces/tabs.
	 * @param line - Line to measure.
	 * @param _tabWidth - Tab width (unused in mock).
	 * @returns The number of leading whitespace characters in the line.
	 */
	public static getIndentSize(line: string, _tabWidth: number): number {
		const trimmed = line.trimStart();
		const indent = line.length - trimmed.length;
		return indent;
	}

	/**
	 * Mock addLeadingComment - adds comment before node.
	 * @param _node - Node to add comment to.
	 * @param _comment - Comment to add.
	 */
	public static addLeadingComment(_node: unknown, _comment: unknown): void {
		// Mock implementation - no-op for testing
	}

	/**
	 * Mock addTrailingComment - adds comment after node.
	 * @param _node - Node to add comment to.
	 * @param _comment - Comment to add.
	 */
	public static addTrailingComment(_node: unknown, _comment: unknown): void {
		// Mock implementation - no-op for testing
	}

	/**
	 * Mock addDanglingComment - adds dangling comment to node.
	 * @param _node - Node to add comment to.
	 * @param _comment - Comment to add.
	 * @param _marker - Comment marker.
	 */
	public static addDanglingComment(
		_node: unknown,
		_comment: unknown,
		_marker: unknown,
	): void {
		// Mock implementation - no-op for testing
	}
}

/**
 * Mock implementation of Prettier doc printer.
 */
class MockDocPrinter {
	/**
	 * Mock printDocToString - converts Doc to string representation.
	 * @param doc - Document to print.
	 * @param _options - Parser options (unused in mock).
	 * @returns String representation of document.
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
			return doc.map((d) => this.printDocToString(d, _options)).join('');
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
class PrettierMockSuite {
	/**
	 * Mock implementation of prettier.format.
	 * Can be customized with custom implementations.
	 */
	public format = vi.fn(
		(
			code: string,
			_options?: Readonly<
				ParserOptions & { parser?: string; plugins?: unknown[] }
			>,
		): Promise<string> => {
			// Default: return code as-is (identity formatter)
			return Promise.resolve(code);
		},
	);

	private readonly docBuilders = new MockDocBuilders();
	private readonly util = new MockPrettierUtil();
	private readonly docPrinter = new MockDocPrinter();

	/**
	 * Creates a mock Prettier plugin structure.
	 * @param overrides - Optional overrides for default plugin structure.
	 * @returns A Prettier plugin object with default structure and optional overrides applied.
	 * @example
	 * ```typescript
	 * const mock = new PrettierMockSuite();
	 * const plugin = mock.createMockPlugin({
	 *   printers: { apex: { print: vi.fn() } }
	 * });
	 * ```
	 */
	public static createMockPlugin(
		overrides?: Partial<Plugin<ApexNode>>,
	): Plugin<ApexNode> {
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
	public static createMockPrinter(
		printImplementation?: (
			path: Readonly<AstPath<ApexNode>>,
			options: Readonly<ParserOptions>,
			print: (path: Readonly<AstPath<ApexNode>>) => Doc,
		) => Doc,
	): Printer<ApexNode> {
		return {
			print: printImplementation ?? vi.fn(() => 'mock output'),
		} as Printer<ApexNode>;
	}

	/**
	 * Creates a complete Prettier mock object that can be used with vi.mock.
	 * @param customizations - Optional customizations to override default mocks.
	 * @param customizations.format - Custom format function implementation.
	 * @param customizations.doc - Custom doc builders configuration.
	 * @param customizations.doc.builders - Custom doc builders to override defaults.
	 * @param customizations.util - Custom Prettier utilities to override defaults.
	 * @param customizations.docPrinter - Custom doc printer to override defaults.
	 * @returns Mock Prettier module object.
	 * @example
	 * ```typescript
	 * const mock = new PrettierMockSuite();
	 * mock.format.mockResolvedValue('formatted code');
	 * vi.mock('prettier', () => mock.getPrettierMock());
	 * ```
	 */
	public getPrettierMock(customizations?: {
		format?: typeof this.format;
		doc?: { builders?: Partial<MockDocBuilders> };
		util?: Partial<MockPrettierUtil>;
		docPrinter?: Partial<MockDocPrinter>;
	}): typeof import('prettier') {
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
	 * Gets the mock Doc builders.
	 * Useful for accessing builders directly in tests.
	 */
	public getDocBuilders(): MockDocBuilders {
		return this.docBuilders;
	}

	/**
	 * Gets the mock Prettier utilities.
	 * Useful for accessing utilities directly in tests.
	 */
	public getUtil(): MockPrettierUtil {
		return this.util;
	}

	/**
	 * Gets the mock doc printer.
	 * Useful for accessing doc printer directly in tests.
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
 * @param options - Optional configuration for the mock.
 * @param options.format - Custom format function implementation.
 * @returns Mock Prettier module.
 * @example
 * ```typescript
 * vi.mock('prettier', () => createPrettierMock({
 *   format: vi.fn().mockResolvedValue('formatted')
 * }));
 * ```
 */
function createPrettierMock(options?: {
	format?: (
		code: string,
		opts?: Readonly<
			ParserOptions & { parser?: string; plugins?: unknown[] }
		>,
	) => Promise<string>;
}): typeof import('prettier') {
	const suite = new PrettierMockSuite();
	if (options?.format) {
		suite.format = options.format;
	}
	return suite.getPrettierMock();
}

// Export all functions and constants in a single export declaration
export { PrettierMockSuite, createPrettierMock, defaultPrettierMock };
