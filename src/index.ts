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
	getIndentLevel,
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
 * @param _options - Parser options (unused but required by Prettier API).
 * @param _print - Print function (unused but required by Prettier API).
 * @param _originalPrintComment - Original print comment function (unused but required by Prettier API).
 * @returns The formatted comment as a Prettier Doc.
 * @example
 * ```typescript
 * const doc = customPrintComment(path);
 * ```
 */

const customPrintComment = (
	path: Readonly<AstPath<ApexNode>>,
	_options: Readonly<ParserOptions>,
	_print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	_originalPrintComment: (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	) => Doc,
	// eslint-disable-next-line @typescript-eslint/max-params -- Prettier printComment API requires 4 parameters
): Doc => {
	const node = path.getNode();

	/**
	 * Check if this is an ApexDoc comment using the same logic as prettier-plugin-apex.
	 * But be more lenient: allow malformed comments (lines without asterisks) to be detected as ApexDoc
	 * if they start with / ** and end with * /.
	 * @param comment - The comment node to check.
	 * @returns True if the comment is an ApexDoc comment, false otherwise.
	 * @example
	 * ```typescript
	 * const isDoc = isApexDoc(commentNode);
	 * ```
	 */
	const isApexDoc = (comment: unknown): boolean => {
		if (
			comment === null ||
			comment === undefined ||
			typeof comment !== 'object' ||
			!('value' in comment) ||
			typeof comment.value !== 'string'
		) {
			return false;
		}
		const commentValue = (comment as { value: string }).value;
		// Must start with /** and end with */
		if (
			!commentValue.trimStart().startsWith('/**') ||
			!commentValue.trimEnd().endsWith('*/')
		) {
			return false;
		}
		const lines = commentValue.split('\n');
		// For well-formed ApexDoc, all middle lines should have asterisks
		// For malformed ApexDoc, we still want to detect it if it starts with /** and ends with */
		// If it has at least one middle line with an asterisk, treat it as ApexDoc
		// If it has NO asterisks but starts with /** and ends with */, also treat it as ApexDoc
		// (so we can normalize it by adding asterisks)
		if (lines.length <= INDEX_ONE) return false;
		const middleLines = lines.slice(INDEX_ONE, lines.length - INDEX_ONE);
		// If at least one middle line has an asterisk, treat it as ApexDoc (even if malformed)
		if (
			middleLines.some((commentLine) =>
				commentLine.trim().startsWith('*'),
			)
		) {
			return true;
		}
		// If no middle lines have asterisks but comment starts with /** and ends with */,
		// treat it as ApexDoc so we can normalize it (add asterisks)
		return middleLines.length > ARRAY_START_INDEX;
	};

	if (
		node !== null &&
		isApexDoc(node) &&
		'value' in node &&
		typeof node['value'] === 'string'
	) {
		const commentNode = node as unknown as { value: string };
		const commentValue = commentNode.value;
		if (commentValue === '') return '';

		// Get stored options from printer
		const options = getCurrentPrintOptions();
		if (!options) {
			// Fallback to original behavior if options not available
			const originalPrintComment = (
				originalApexPrinter as Record<string, unknown>
			)['printComment'] as
				| ((path: Readonly<AstPath<ApexNode>>) => Doc)
				| undefined;
			if (originalPrintComment) {
				return originalPrintComment(path);
			}
			return commentValue;
		}

		// Calculate comment indent from the original text
		// The comment value from AST might not include leading spaces, so we need to check the original text
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- options.tabWidth can be undefined in ParserOptions
		const tabWidthValue = options.tabWidth ?? DEFAULT_TAB_WIDTH;
		const originalText = getCurrentOriginalText();
		let commentIndent = 0;
		const commentLines = commentValue.split('\n');
		const firstLine = commentLines[ARRAY_START_INDEX];
		if (originalText !== undefined && originalText !== '') {
			// Find the comment start in the original text
			const commentStart = originalText.indexOf(commentValue.trimStart());
			if (commentStart >= ARRAY_START_INDEX) {
				// Find the start of the line containing the comment
				const lineStart =
					originalText.lastIndexOf('\n', commentStart) + INDEX_ONE;
				const linePrefix = originalText.substring(
					lineStart,
					commentStart,
				);
				commentIndent = getIndentLevel(linePrefix, tabWidthValue);
			} else if (firstLine !== undefined) {
				// Fallback: try to get indent from first line of comment value
				commentIndent = getIndentLevel(firstLine, tabWidthValue);
			}
		} else if (firstLine !== undefined) {
			// Fallback: try to get indent from first line of comment value
			commentIndent = getIndentLevel(firstLine, tabWidthValue);
		}

		// Check if embed has already formatted code blocks for this comment
		// Create a key to look up formatted version (same logic as in embed)
		const codeTagPos = commentValue.indexOf('{@code');
		const commentKey = `${String(commentValue.length)}-${String(codeTagPos)}`;
		const embedFormattedComment = getFormattedCodeBlock(commentKey);

		// Use embed-formatted comment if available, otherwise normalize the original
		// Code blocks are now handled via embed function (using textToDoc) instead of preprocessor
		// CRITICAL: Even if embed has formatted the code blocks, we still need to normalize annotations
		// The embed function only formats code blocks, it doesn't normalize ApexDoc annotations
		// So we always normalize the comment (either the embed-formatted version or the original)
		const commentToNormalize = embedFormattedComment ?? commentValue;
		const normalizedComment = normalizeSingleApexDocComment(
			commentToNormalize,
			commentIndent,
			options,
		);

		// Copy of printApexDocComment from prettier-plugin-apex:
		// function printApexDocComment(comment) {
		//     const lines = comment.value.split("\n");
		//     return [
		//         join(hardline, lines.map((commentLine, index) => (index > 0 ? " " : "") +
		//             (index < lines.length - 1
		//                 ? commentLine.trim()
		//                 : commentLine.trimStart()))),
		//     ];
		// }
		const lines = normalizedComment.split('\n');
		const { join, hardline } = prettier.doc.builders;

		// Process code block lines using the function from apexdoc-code.ts
		const processedLines = processCodeBlockLines(lines);

		return [join(hardline, [...processedLines])];
	}

	// For non-ApexDoc comments, use the original behavior
	const originalPrintComment = (
		originalApexPrinter as Record<string, unknown>
	)['printComment'] as
		| ((path: Readonly<AstPath<ApexNode>>) => Doc)
		| undefined;
	if (originalPrintComment) {
		return originalPrintComment(path);
	}
	// Fallback if printComment doesn't exist
	const commentNode = node as { value?: string };
	return commentNode.value ?? '';
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

/**
 * Parameters for determining if a code block should be skipped.
 */
export interface ShouldSkipCodeBlockParams {
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
const shouldSkipCodeBlock = (
	params: Readonly<ShouldSkipCodeBlockParams>,
): boolean => {
	const { formattedCode, originalCode } = params;

	// Skip if formatted code is empty (only whitespace)
	if (formattedCode.trim() === '') {
		return true;
	}

	// Skip if formatted code starts with FORMAT_FAILED_PREFIX
	if (formattedCode.startsWith('__FORMAT_FAILED__')) {
		return true;
	}

	// Skip if formatted equals original and contains newlines
	// This indicates the code block wasn't actually formatted and just contains whitespace/newlines
	if (formattedCode === originalCode && formattedCode.includes('\n')) {
		return true;
	}

	return false;
};

/**
 * Wraps parsers to add annotation normalization.
 * @param parsers - The parsers to wrap.
 * @param _pluginInstance - The plugin instance (unused, kept for API compatibility).
 * @returns The wrapped parsers, or the original parsers if null/undefined.
 * @example
 * ```typescript
 * const wrapped = wrapParsers(originalParsers, plugin);
 * ```
 */
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
export { isApexParser, shouldSkipCodeBlock, wrapParsers };
