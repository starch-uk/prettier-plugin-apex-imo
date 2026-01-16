/**
 * @file Reusable Prettier mock suite for testing.
 *
 * Provides comprehensive mocks for Prettier APIs including Doc builders,
 * utilities, format function, and plugin structures that can be imported
 * and used across test modules.
 *
 * @example
 * ```typescript
 * import { PrettierMockSuite } from './prettier-mock.js';
 * const mock = new PrettierMockSuite();
 * vi.mock('prettier', () => mock.getPrettierMock());
 * ```
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { vi } from 'vitest';
import type {
	AstPath,
	Doc,
	ParserOptions,
	Plugin,
	Printer,
} from 'prettier';
import type { ApexNode } from '../src/types.js';

/**
 * Mock implementation of Prettier Doc builders.
 * These functions return their inputs in a simplified form for testing.
 */
class MockDocBuilders {
	/**
	 * Mock group builder - returns array with 'group' marker.
	 */
	group(doc: Doc): Doc {
		return ['group', doc];
	}

	/**
	 * Mock indent builder - returns array with 'indent' marker.
	 */
	indent(doc: Doc | Doc[]): Doc {
		return ['indent', Array.isArray(doc) ? doc : [doc]];
	}

	/**
	 * Mock softline - returns string marker.
	 */
	softline = 'softline' as Doc;

	/**
	 * Mock hardline - returns string marker.
	 */
	hardline = 'hardline' as Doc;

	/**
	 * Mock line - returns string marker.
	 */
	line = 'line' as Doc;

	/**
	 * Mock ifBreak builder - returns array with 'ifBreak' marker.
	 */
	ifBreak(ifBreak: Doc, noBreak: Doc = ''): Doc {
		return ['ifBreak', ifBreak, noBreak];
	}

	/**
	 * Mock join builder - joins docs with separator.
	 */
	join(separator: Doc, docs: readonly Doc[]): Doc {
		return ['join', separator, ...docs];
	}

	/**
	 * Mock fill builder - returns array with 'fill' marker.
	 */
	fill(docs: readonly Doc[]): Doc {
		return ['fill', ...docs];
	}
}

/**
 * Mock implementation of Prettier utilities.
 */
class MockPrettierUtil {
	/**
	 * Mock getStringWidth - returns string length.
	 */
	getStringWidth(str: string): number {
		return str.length;
	}

	/**
	 * Mock skipWhitespace - returns index after whitespace.
	 */
	skipWhitespace(text: string, startIndex: number): number {
		let index = startIndex;
		while (index < text.length && /\s/.test(text[index]!)) {
			index++;
		}
		return index;
	}

	/**
	 * Mock getIndentSize - calculates indent size based on leading spaces/tabs.
	 */
	getIndentSize(line: string, tabWidth: number): number {
		const trimmed = line.trimStart();
		const indent = line.length - trimmed.length;
		return indent;
	}

	/**
	 * Mock addLeadingComment - adds comment before node.
	 */
	addLeadingComment(node: unknown, comment: unknown): void {
		// Mock implementation - no-op for testing
	}

	/**
	 * Mock addTrailingComment - adds comment after node.
	 */
	addTrailingComment(node: unknown, comment: unknown): void {
		// Mock implementation - no-op for testing
	}

	/**
	 * Mock addDanglingComment - adds dangling comment to node.
	 */
	addDanglingComment(node: unknown, comment: unknown, marker: unknown): void {
		// Mock implementation - no-op for testing
	}
}

/**
 * Mock implementation of Prettier doc printer.
 */
class MockDocPrinter {
	/**
	 * Mock printDocToString - converts Doc to string representation.
	 */
	printDocToString(doc: Doc, options?: Readonly<ParserOptions>): string {
		// Simple stringification for testing
		if (typeof doc === 'string') {
			return doc;
		}
		if (Array.isArray(doc)) {
			return doc.map((d) => this.printDocToString(d, options)).join('');
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
 * - Plugin structures
 */
export class PrettierMockSuite {
	private readonly docBuilders = new MockDocBuilders();
	private readonly util = new MockPrettierUtil();
	private readonly docPrinter = new MockDocPrinter();

	/**
	 * Mock implementation of prettier.format.
	 * Can be customized with custom implementations.
	 */
	format = vi.fn(
		async (
			code: string,
			options?: Readonly<ParserOptions & { parser?: string; plugins?: unknown[] }>,
		): Promise<string> => {
			// Default: return code as-is (identity formatter)
			return code;
		},
	);

	/**
	 * Creates a complete Prettier mock object that can be used with vi.mock.
	 * @param customizations - Optional customizations to override default mocks.
	 * @returns Mock Prettier module object.
	 * @example
	 * ```typescript
	 * const mock = new PrettierMockSuite();
	 * mock.format.mockResolvedValue('formatted code');
	 * vi.mock('prettier', () => mock.getPrettierMock());
	 * ```
	 */
	getPrettierMock(customizations?: {
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
			format: customizations?.format ?? this.format,
			doc: {
				builders: customDocBuilders,
				printer: customDocPrinter,
			},
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
		overrides?: Partial<Plugin<ApexNode>>,
	): Plugin<ApexNode> {
		return {
			languages: [],
			parsers: {},
			printers: {},
			options: {},
			defaultOptions: {},
			...overrides,
		} as Plugin<ApexNode>;
	}

	/**
	 * Creates a mock printer object.
	 * @param printImplementation - Optional custom print function.
	 * @returns Mock printer object.
	 */
	createMockPrinter(
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
 */
export const defaultPrettierMock = new PrettierMockSuite();

/**
 * Helper to create a mock Prettier module with custom format implementation.
 * @param formatImpl - Custom format function implementation.
 * @returns Mock Prettier module.
 * @example
 * ```typescript
 * vi.mock('prettier', () => createPrettierMock({
 *   format: vi.fn().mockResolvedValue('formatted')
 * }));
 * ```
 */
export function createPrettierMock(options?: {
	format?: (
		code: string,
		opts?: Readonly<ParserOptions & { parser?: string; plugins?: unknown[] }>,
	) => Promise<string>;
}): typeof import('prettier') {
	const suite = new PrettierMockSuite();
	if (options?.format) {
		suite.format = options.format;
	}
	return suite.getPrettierMock();
}
