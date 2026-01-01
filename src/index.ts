/**
 * @file Main entry point for prettier-plugin-apex-imo. Extends prettier-plugin-apex with custom formatting behaviour.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import type { Plugin, ParserOptions } from 'prettier';
import * as apexPlugin from 'prettier-plugin-apex';
import { createWrappedPrinter } from './printer.js';
import type { ApexNode } from './types.js';
import {
	findApexDocCodeBlocks,
	formatCodeBlock,
	FORMAT_FAILED_PREFIX,
	EMPTY_CODE_TAG,
} from './apexdoc.js';
import { applyCommentIndentation, createClosingIndent } from './comments.js';
import { normalizeAnnotationNamesInText } from './annotations.js';

const APEX_PARSERS = ['apex', 'apex-anonymous'] as const;
const ARRAY_START_INDEX = 0;
const LAST_INDEX_OFFSET = 1;
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

const wrappedPrinter = createWrappedPrinter(getApexPrinter());

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

/**
 * Parameters for determining if a code block should be skipped.
 */
interface ShouldSkipCodeBlockParams {
	readonly formattedCode: string;
	readonly originalCode: string;
	readonly processedText: string;
	readonly startPos: number;
	readonly endPos: number;
}

/**
 * Determines whether a code block should be skipped during formatting.
 * @param params - Parameters for determining if a code block should be skipped.
 * @param params.formattedCode - The formatted code string.
 * @param params.originalCode - The original code string.
 * @param params.processedText - The processed text string.
 * @param params.startPos - The start position of the code block.
 * @param params.endPos - The end position of the code block.
 * @returns True if the code block should be skipped, false otherwise.
 * @example
 * ```typescript
 * shouldSkipCodeBlock({
 *   formattedCode: '',
 *   originalCode: 'test',
 *   processedText: 'text',
 *   startPos: 0,
 *   endPos: 4
 * }); // Returns true
 * ```
 */
function shouldSkipCodeBlock(
	params: Readonly<ShouldSkipCodeBlockParams>,
): boolean {
	const { formattedCode, originalCode, processedText, startPos, endPos } =
		params;
	const trimmedFormattedCode = formattedCode.trim();
	return (
		// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- string length check
		trimmedFormattedCode.length === 0 ||
		formattedCode.startsWith(FORMAT_FAILED_PREFIX) ||
		(formattedCode === originalCode &&
			processedText.substring(startPos, endPos).includes('\n'))
	);
}

/**
 * Creates a preprocess function for the plugin.
 * @param pluginInstance - The plugin instance to use for formatting.
 * @returns A preprocess function that handles ApexDoc code blocks.
 * @example
 * ```typescript
 * const preprocess = createPreprocess(plugin);
 * const result = await preprocess(text, options);
 * ```
 */
const createPreprocess =
	(pluginInstance: Readonly<Plugin<ApexNode>>) =>
	async (
		text: Readonly<string>,
		options: Readonly<ParserOptions<ApexNode>>,
	): Promise<string> => {
		const { parser } = options;
		if (typeof parser !== 'string' || !isApexParser(parser)) return text;
		const codeBlocks = findApexDocCodeBlocks(text);
		const codeBlocksLength = codeBlocks.length;
		// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- array length check
		if (codeBlocksLength === 0) return text;
		let processedText = text;
		const lastIndex = codeBlocksLength - LAST_INDEX_OFFSET;
		for (let i = lastIndex; i >= ARRAY_START_INDEX; i--) {
			// Array indexing within valid bounds always returns a value
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Index is guaranteed to be valid
			const block = codeBlocks[i]!;
			const { code: blockCode, startPos, endPos } = block;
			const trimmedBlockCode = blockCode.trim();
			// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- string length check
			if (trimmedBlockCode.length === 0) {
				processedText =
					processedText.substring(ARRAY_START_INDEX, startPos) +
					EMPTY_CODE_TAG +
					processedText.substring(endPos);
				continue;
			}
			const formattedCode = await formatCodeBlock(
				blockCode,
				options,
				pluginInstance,
			);
			if (
				shouldSkipCodeBlock({
					endPos,
					formattedCode,
					originalCode: blockCode,
					processedText,
					startPos,
				})
			)
				continue;
			const closingIndent = createClosingIndent(
				block.commentIndent,
				options.tabWidth,
				options.useTabs,
			);
			const beforeBlock = processedText.substring(
				ARRAY_START_INDEX,
				startPos,
			);
			const afterBlock = processedText.substring(endPos);
			processedText =
				beforeBlock +
				`{@code\n${applyCommentIndentation(formattedCode, block, options)}\n${closingIndent} * }` +
				afterBlock;
		}
		return processedText;
	};

/**
 * Wraps parsers to add custom preprocessing and annotation normalization.
 * @param parsers - The parsers to wrap.
 * @param pluginInstance - The plugin instance to use for preprocessing.
 * @returns The wrapped parsers, or the original parsers if null/undefined.
 * @example
 * ```typescript
 * const wrapped = wrapParsers(originalParsers, plugin);
 * ```
 */
const wrapParsers = (
	parsers: Readonly<Plugin<ApexNode>['parsers']>,
	pluginInstance: Readonly<Plugin<ApexNode>>,
): Plugin<ApexNode>['parsers'] => {
	if (!parsers) return parsers;
	const ourPreprocess = createPreprocess(pluginInstance);
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
				const preprocessedText = originalPreprocess
					? await originalPreprocess(text, options)
					: text;
				return ourPreprocess(
					normalizeAnnotationNamesInText(preprocessedText),
					options,
				);
			},
		};
	}
	return wrappedParsers as Plugin<ApexNode>['parsers'];
};

const apexPluginTyped = apexPlugin as unknown as Plugin<ApexNode>;
const plugin: Plugin<ApexNode> = {
	...apexPluginTyped,
	printers: { apex: wrappedPrinter },
};
plugin.parsers = wrapParsers(apexPluginTyped.parsers, plugin);
export default plugin;
// eslint-disable-next-line import/group-exports -- Destructuring export and function exports need separate declarations
export const { languages, parsers, printers, options, defaultOptions } = plugin;
// eslint-disable-next-line import/group-exports -- Functions and types need separate export
export {
	createPreprocess,
	isApexParser,
	shouldSkipCodeBlock,
	wrapParsers,
	type ShouldSkipCodeBlockParams,
};
