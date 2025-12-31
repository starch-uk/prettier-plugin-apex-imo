/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import type { AstPath, Doc, Plugin, ParserOptions } from 'prettier';
import * as apexPlugin from 'prettier-plugin-apex';
import { createWrappedPrinter } from './printer.js';
import type { ApexNode } from './types.js';
import {
	findApexDocCodeBlocks,
	formatCodeBlock,
	applyCommentIndentation,
	normalizeAnnotationName,
	normalizeAnnotationOptionName,
} from './utils.js';

// Get the original apex printer
// Access printers directly from apexPlugin to avoid type assertion on the plugin itself
const apexPrinter = (apexPlugin as { printers?: { apex?: unknown } }).printers
	?.apex;
if (apexPrinter === null || apexPrinter === undefined) {
	throw new Error(
		'prettier-plugin-apex-imo requires prettier-plugin-apex to be installed. ' +
			'The apex printer was not found.',
	);
}
// Type guard to check if printer has the expected structure
function hasPrintMethod(printer: unknown): printer is {
	[key: string]: unknown;
	print: (
		path: AstPath<ApexNode>,
		options: ParserOptions<ApexNode>,
		print: (path: AstPath<ApexNode>) => Doc,
	) => Doc;
} {
	return (
		typeof printer === 'object' &&
		printer !== null &&
		'print' in printer &&
		typeof (printer as { print?: unknown }).print === 'function'
	);
}
if (!hasPrintMethod(apexPrinter)) {
	throw new Error('Apex printer does not have the expected print method');
}
const originalPrinterUntyped = apexPrinter;

// Create our wrapped printer
const wrappedPrinter = createWrappedPrinter(originalPrinterUntyped);

/**
 * Normalize annotation option names within parameter content
 * Options can be: optionName=value or optionName value (space-separated)
 */
function normalizeAnnotationOptions(
	annotationName: string,
	paramContent: string,
): string {
	// Use regex to find and replace option names
	return paramContent.replace(
		/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g,
		(match, optionName: string) => {
			const normalized = normalizeAnnotationOptionName(
				annotationName,
				optionName,
			);
			return normalized !== optionName ? `${normalized}=` : match;
		},
	);
}

/**
 * Normalize annotation names in text to PascalCase
 * Also normalizes annotation option names to camelCase
 * This allows the parser to handle incorrectly cased annotation names and options
 */
function normalizeAnnotationNamesInText(text: string): string {
	return text
		.replace(
			/@([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g,
			(_match, name: string, params: string) => {
				const normalizedName = normalizeAnnotationName(name);
				const normalizedParams = normalizeAnnotationOptions(
					normalizedName,
					params,
				);
				return `@${normalizedName}(${normalizedParams})`;
			},
		)
		.replace(
			/@([a-zA-Z_][a-zA-Z0-9_]*)(?![a-zA-Z0-9_(])/g,
			(_match, name: string) => {
				const normalizedName = normalizeAnnotationName(name);
				return `@${normalizedName}`;
			},
		);
}

/**
 * Preprocess text to format {@code} blocks in ApexDoc comments
 */
function createPreprocess(
	pluginInstance: Readonly<Plugin<ApexNode>>,
): (
	text: Readonly<string>,
	options: Readonly<ParserOptions<ApexNode>>,
) => Promise<string> | string {
	return async function preprocess(
		text: Readonly<string>,
		options: Readonly<ParserOptions<ApexNode>>,
	): Promise<string> {
		// Only process Apex files
		if (options.parser !== 'apex' && options.parser !== 'apex-anonymous') {
			return text;
		}

		// Note: Annotation names are normalized by the parser wrapper's preprocess before this is called
		// This function only handles ApexDoc code blocks
		let processedText = text;

		const codeBlocks = findApexDocCodeBlocks(processedText);

		if (codeBlocks.length === 0) {
			return processedText;
		}

		// Process blocks in reverse order to maintain positions
		// Format all blocks asynchronously
		// Note: processedText already has normalized annotations from above
		for (let i = codeBlocks.length - 1; i >= 0; i--) {
			const block = codeBlocks[i];

			// Handle empty code blocks - normalize to {@code}
			if (!block.code || block.code.trim() === '') {
				// For empty blocks, normalize to {@code} (no space)
				// Replace the original block with normalized version
				const beforeBlock = processedText.substring(0, block.startPos);
				const afterBlock = processedText.substring(block.endPos);
				const newBlock = '{@code}';
				processedText = beforeBlock + newBlock + afterBlock;
				continue;
			}

			// Format the code using our plugin to ensure List/Map formatting rules are applied
			const formattedCode = await formatCodeBlock(
				block.code,
				options,
				pluginInstance,
			);

			// Skip if formatting failed
			if (
				!formattedCode ||
				formattedCode.trim() === '' ||
				formattedCode.startsWith('__FORMAT_FAILED__')
			) {
				continue;
			}

			// Skip if code unchanged and block already properly formatted
			if (formattedCode === block.code) {
				const originalBlockText = processedText.substring(
					block.startPos,
					block.endPos,
				);
				if (originalBlockText.includes('\n')) {
					continue;
				}
			}

			// Apply proper indentation
			const indentedCode = applyCommentIndentation(
				formattedCode,
				block,
				options,
			);

			// Replace the original code block
			const beforeBlock = processedText.substring(0, block.startPos);
			const afterBlock = processedText.substring(block.endPos);

			// Reconstruct the block with formatted code
			const { tabWidth, useTabs } = options;
			const closingIndent =
				useTabs === true
					? '\t'.repeat(Math.floor(block.commentIndent / tabWidth))
					: ' '.repeat(block.commentIndent);

			// Reconstruct as: {@code\n   * formatted code\n   * }
			// Always format the block structure to have code on a new line
			const newBlock =
				'{@code\n' + indentedCode + '\n' + closingIndent + ' * }';

			processedText = beforeBlock + newBlock + afterBlock;
		}

		return processedText;
	};
}

// Type for parser with optional preprocess function
interface ParserWithPreprocess {
	[key: string]: unknown;
	preprocess?: (
		text: Readonly<string>,
		options: Readonly<ParserOptions<ApexNode>>,
	) => Promise<string> | string;
}

// Wrap parsers to add our preprocess function
function wrapParsers(
	parsers: Readonly<Plugin<ApexNode>['parsers']>,
	pluginInstance: Readonly<Plugin<ApexNode>>,
): Plugin<ApexNode>['parsers'] {
	const ourPreprocess = createPreprocess(pluginInstance);
	if (!parsers) {
		return parsers;
	}
	const wrappedParsers: Record<string, ParserWithPreprocess> = {};
	for (const parserName in parsers) {
		if (!Object.prototype.hasOwnProperty.call(parsers, parserName))
			continue;
		const originalParser = parsers[parserName];
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions
		if (!originalParser?.parse) continue;

		const originalPreprocess = originalParser.preprocess;
		const originalParse = originalParser.parse;

		wrappedParsers[parserName] = {
			...originalParser,
			parse: async (
				text: Readonly<string>,
				options: Readonly<ParserOptions<ApexNode>>,
			): Promise<ApexNode> => {
				return await originalParse(
					normalizeAnnotationNamesInText(text),
					options,
				);
			},
			preprocess: async (
				text: Readonly<string>,
				options: Readonly<ParserOptions<ApexNode>>,
			): Promise<string> => {
				const result = originalPreprocess
					? originalPreprocess(text, options)
					: text;
				const preprocessed =
					result instanceof Promise ? await result : result;
				const normalized = normalizeAnnotationNamesInText(preprocessed);
				return await ourPreprocess(normalized, options);
			},
		} as ParserWithPreprocess;
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	return wrappedParsers as unknown as Plugin<ApexNode>['parsers'];
}

/**
 * prettier-plugin-apex-imo
 *
 * Extends prettier-plugin-apex to enforce multiline formatting for
 * Lists and Maps with 2+ entries, and formats code in ApexDoc {@code} blocks.
 */

// Create the plugin first (without wrapped parsers) so we can pass it to wrapParsers
// This allows formatCodeBlock to use our wrapped printer for List/Map formatting
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const apexPluginTyped = apexPlugin as unknown as Plugin<ApexNode>;
const plugin: Plugin<ApexNode> = {
	// Re-export languages from apex plugin
	languages: apexPluginTyped.languages,

	// Temporarily use original parsers - will be updated below
	parsers: apexPluginTyped.parsers,

	// Provide our wrapped printer
	printers: {
		apex: wrappedPrinter,
	},

	// Re-export options from apex plugin (if any)
	options: apexPluginTyped.options,

	// Re-export defaultOptions from apex plugin (if any)
	defaultOptions: apexPluginTyped.defaultOptions,
};

// Now wrap parsers with the actual plugin instance so formatCodeBlock can use our wrapped printer
const wrappedParsers = wrapParsers(apexPluginTyped.parsers, plugin);

// Update the plugin with wrapped parsers
plugin.parsers = wrappedParsers;

export default plugin;

// Named exports for ESM compatibility
export const { languages, parsers, printers, options, defaultOptions } = plugin;
