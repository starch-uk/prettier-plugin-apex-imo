/**
 * @file Main entry point for prettier-plugin-apex-imo. Extends prettier-plugin-apex with custom formatting behaviour.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import type { Plugin, ParserOptions, AstPath, Doc } from 'prettier';
import * as apexPlugin from 'prettier-plugin-apex';
import { createWrappedPrinter } from './printer.js';
import type { ApexNode } from './types.js';
import {
	printComment as printCommentFn,
	handleOwnLineComment,
	handleEndOfLineComment,
	handleRemainingComment,
} from './comments.js';
import {
	canAttachComment,
	getCurrentOriginalText,
	getFormattedCodeBlock,
	isBlockComment,
	setCurrentPluginInstance,
} from './printer.js';

const APEX_PARSERS = ['apex', 'apex-anonymous'] as const;
const APEX_PARSERS_SET = new Set<string>(APEX_PARSERS);
const APEX_PRINTER_ERROR_MESSAGE =
	'prettier-plugin-apex-imo requires prettier-plugin-apex to be installed. The apex printer was not found.';

// eslint-disable-next-line @typescript-eslint/no-type-alias, @typescript-eslint/no-magic-numbers -- Need to extract array element type, index 0 is required
type ApexPrinterType = Parameters<typeof createWrappedPrinter>[0];

const getApexPrinter = (): ApexPrinterType => {
	const apexPrinter = (apexPlugin as { printers?: { apex?: unknown } })
		.printers?.apex;
	if (
		typeof apexPrinter !== 'object' ||
		apexPrinter === null ||
		typeof (apexPrinter as { print?: unknown }).print !== 'function'
	) {
		throw new Error(APEX_PRINTER_ERROR_MESSAGE);
	}
	return apexPrinter as ApexPrinterType;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const originalApexPrinter = getApexPrinter();

/**
 * PrintComment function that preserves our wrapped lines.
 * The original printApexDocComment trims each line, which removes our carefully
 * calculated wrapping. This version preserves the line structure we created.
 * @param path - The AST path to the comment node.
 * @param options - Parser options (unused but required by Prettier API).
 * @param print - Print function (unused but required by Prettier API).
 * @param originalPrintComment - Original print comment function (unused but required by Prettier API).
 * @returns The formatted comment as a Prettier Doc.
 * @example
 * ```typescript
 * const doc = printComment(path);
 * ```
 */
/* eslint-disable-next-line @typescript-eslint/max-params -- Prettier printComment API requires 4 parameters */
const printComment = (
	path: Readonly<AstPath<ApexNode>>,
	options: Readonly<ParserOptions>,
	print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	originalPrintComment: (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	) => Doc,
	// eslint-disable-next-line @typescript-eslint/max-params -- Prettier printComment API requires 4 parameters
): Doc => {
	// Use the centralized comment processing logic
	// Use options parameter directly - it's always provided by Prettier's API
	// storedOptions is set in print() but options is more reliable here
	return printCommentFn(
		path,
		options,
		print,
		originalPrintComment,
		options,
		getCurrentOriginalText,
		getFormattedCodeBlock,
	);
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const wrappedPrinter = {
	...createWrappedPrinter(originalApexPrinter),
	canAttachComment,
	handleComments: {
		endOfLine: handleEndOfLineComment,
		ownLine: handleOwnLineComment,
		remaining: handleRemainingComment,
	},
	isBlockComment,
	printComment,
};

/**
 * Checks if a parser name is an Apex parser.
 * @param parser - The parser name to check.
 * @returns True if the parser is an Apex parser, false otherwise.
 * @example
 * ```typescript
 * isApexParser('apex'); // Returns true
 * isApexParser('typescript'); // Returns false
 * isApexParser(undefined); // Returns false
 * ```
 */
const isApexParser = (
	parser: string | undefined,
): parser is (typeof APEX_PARSERS)[number] =>
	typeof parser === 'string' && APEX_PARSERS_SET.has(parser);

const wrapParsers = (
	parsers: Readonly<Plugin<ApexNode>['parsers']>,
	_pluginInstance: Readonly<Plugin<ApexNode>>,
): Plugin<ApexNode>['parsers'] => {
	if (!parsers) return parsers;
	const wrappedParsers: Record<string, unknown> = {};
	for (const parserName in parsers) {
		const parser = parsers[parserName];
		if (
			!Object.prototype.hasOwnProperty.call(parsers, parserName) ||
			parser === undefined
		) {
			continue;
		}
		if (typeof parser.parse !== 'function') {
			continue;
		}
		const originalParser = parser;
		wrappedParsers[parserName] = {
			...originalParser,
			// eslint-disable-next-line @typescript-eslint/max-params -- parse function requires 2 parameters
			parse: async (
				text: Readonly<string>,
				options: Readonly<ParserOptions<ApexNode>>,
			): Promise<ApexNode> => originalParser.parse(text, options),
		};
	}
	return wrappedParsers as Plugin<ApexNode>['parsers'];
};

const apexPluginTyped = apexPlugin as unknown as Plugin<ApexNode>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Plugin extension requires spreading
const plugin: Plugin<ApexNode> = {
	...apexPluginTyped,
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Printer assignment requires any type
	printers: {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Printer requires any type
		apex: wrappedPrinter,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Printer requires any type
		'apex-anonymous': wrappedPrinter,
	},
};
plugin.parsers = wrapParsers(apexPluginTyped.parsers, plugin);

// Store plugin instance for use in embed function
setCurrentPluginInstance({ default: plugin });

export default plugin;
// eslint-disable-next-line import/group-exports -- Destructuring export and function exports need separate declarations
export const { languages, parsers, printers, options, defaultOptions } = plugin;
// eslint-disable-next-line import/group-exports -- Functions and types need separate export
export { isApexParser, wrapParsers };
