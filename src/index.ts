/**
 * @file Main entry point for prettier-plugin-apex-imo. Extends prettier-plugin-apex with custom formatting behaviour.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import type { Plugin, ParserOptions, AstPath, Doc } from 'prettier';
import * as apexPlugin from 'prettier-plugin-apex';
import * as prettier from 'prettier';
import { createWrappedPrinter } from './printer.js';
import type { ApexNode } from './types.js';
import { normalizeSingleApexDocComment } from './apexdoc.js';
import { processCodeBlockLines } from './apexdoc-code.js';
import {
	customPrintComment as customPrintCommentFn,
	ARRAY_START_INDEX,
	DEFAULT_TAB_WIDTH,
	INDEX_ONE,
} from './comments.js';
import { normalizeAnnotationNamesInText } from './annotations.js';
import {
	getCurrentPrintOptions,
	getCurrentOriginalText,
	getFormattedCodeBlock,
	setCurrentPluginInstance,
} from './printer.js';

const APEX_PARSERS = ['apex', 'apex-anonymous'] as const;
const APEX_PRINTER_ERROR_MESSAGE =
	'prettier-plugin-apex-imo requires prettier-plugin-apex to be installed. The apex printer was not found.';

const getApexPrinter = (): Parameters<
	typeof createWrappedPrinter
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- type parameter index must be literal 0
>[0] => {
	const apexPrinter = (apexPlugin as { printers?: { apex?: unknown } })
		.printers?.apex;
	if (
		typeof apexPrinter !== 'object' ||
		apexPrinter === null ||
		typeof (apexPrinter as { print?: unknown }).print !== 'function'
	) {
		throw new Error(APEX_PRINTER_ERROR_MESSAGE);
	}
	return apexPrinter as Parameters<
		typeof createWrappedPrinter
		// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- type parameter index must be literal 0
	>[0];
};

const originalApexPrinter = getApexPrinter();

/**
 * Custom printComment function that preserves our wrapped lines.
 * The original printApexDocComment trims each line, which removes our carefully
 * calculated wrapping. This version preserves the line structure we created.
 * @param path - The AST path to the comment node.
 * @param options - Parser options (unused but required by Prettier API).
 * @param print - Print function (unused but required by Prettier API).
 * @param originalPrintComment - Original print comment function (unused but required by Prettier API).
 * @returns The formatted comment as a Prettier Doc.
 * @example
 * ```typescript
 * const doc = customPrintComment(path);
 * ```
 */
const customPrintComment = (
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
	// Get stored options from printer
	const storedOptions = getCurrentPrintOptions();
	if (!storedOptions) {
		// Fallback to original behavior if options not available
		const originalPrintCommentFn = (
			originalApexPrinter as Record<string, unknown>
		)['printComment'] as
			| ((path: Readonly<AstPath<ApexNode>>) => Doc)
			| undefined;
		if (originalPrintCommentFn) {
			return originalPrintCommentFn(path);
		}
		const node = path.getNode();
		const commentNode = node as { value?: string };
		return commentNode.value ?? '';
	}

	// Use the centralized comment processing logic
	const result = customPrintCommentFn(
		path,
		options,
		print,
		originalPrintComment,
		storedOptions,
		getCurrentOriginalText,
		getFormattedCodeBlock,
	);
	return result;
};

const wrappedPrinter = {
	...createWrappedPrinter(originalApexPrinter),
	printComment: customPrintComment,
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
): parser is (typeof APEX_PARSERS)[number] => {
	if (typeof parser !== 'string') return false;
	return APEX_PARSERS.includes(parser as (typeof APEX_PARSERS)[number]);
};


const wrapParsers = (
	parsers: Readonly<Plugin<ApexNode>['parsers']>,
	_pluginInstance: Readonly<Plugin<ApexNode>>,
): Plugin<ApexNode>['parsers'] => {
	if (!parsers) return parsers;
	const wrappedParsers: Record<string, unknown> = {};
	for (const parserName in parsers) {
		if (!Object.prototype.hasOwnProperty.call(parsers, parserName))
			continue;
		const originalParser = parsers[parserName];
		// originalParser can be undefined even after hasOwnProperty check
		if (
			originalParser === undefined ||
			typeof originalParser.parse !== 'function'
		)
			continue;
		const originalPreprocess = originalParser.preprocess;
		wrappedParsers[parserName] = {
			...originalParser,
			parse: async (
				text: Readonly<string>,
				options: Readonly<ParserOptions<ApexNode>>,
			): Promise<ApexNode> =>
				originalParser.parse(
					normalizeAnnotationNamesInText(text),
					options,
				),
			preprocess: async (
				text: Readonly<string>,
				options: Readonly<ParserOptions<ApexNode>>,
			): Promise<string> => {
				// Empty code blocks are now handled in the embed function, not in the preprocessor
				// Only normalize Apex annotations (which should skip ApexDoc comments)
				const preprocessedText = originalPreprocess
					? await originalPreprocess(text, options)
					: text;
				return normalizeAnnotationNamesInText(preprocessedText);
			},
		};
	}
	return wrappedParsers as Plugin<ApexNode>['parsers'];
};

const apexPluginTyped = apexPlugin as unknown as Plugin<ApexNode>;
const plugin: Plugin<ApexNode> = {
	...apexPluginTyped,
	// @ts-expect-error -- Prettier's embed types are complex and don't match our implementation
	printers: { apex: wrappedPrinter },
};
plugin.parsers = wrapParsers(apexPluginTyped.parsers, plugin);

// Store plugin instance for use in embed function
setCurrentPluginInstance({ default: plugin });

export default plugin;
// eslint-disable-next-line import/group-exports -- Destructuring export and function exports need separate declarations
export const { languages, parsers, printers, options, defaultOptions } = plugin;
// eslint-disable-next-line import/group-exports -- Functions and types need separate export
export { isApexParser };
