/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { AstPath, Doc, Plugin, ParserOptions } from 'prettier';
import * as apexPlugin from 'prettier-plugin-apex';
import { createWrappedPrinter } from './printer.js';
import type { ApexNode } from './types.js';
import {
	findApexDocCodeBlocks,
	formatCodeBlock,
	applyCommentIndentation,
} from './utils.js';

// Constants for magic numbers
const magicNumbers = {
	zero: 0,
	one: 1,
	two: 2,
} as const;

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

		const codeBlocks = findApexDocCodeBlocks(text);

		if (codeBlocks.length === magicNumbers.zero) {
			return text;
		}

		// Process blocks in reverse order to maintain positions
		// Format all blocks asynchronously
		let processedText = text;
		for (
			let i = codeBlocks.length - magicNumbers.one;
			i >= magicNumbers.zero;
			i--
		) {
			const block = codeBlocks[i];

			// Handle empty code blocks - normalize to {@code}
			if (!block.code || block.code.trim() === '') {
				// For empty blocks, normalize to {@code} (no space)
				// Replace the original block with normalized version
				const beforeBlock = processedText.substring(
					magicNumbers.zero,
					block.startPos,
				);
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

			// If formatting failed or returned the original code unchanged, preserve original format
			// Check if the formatted code is the same as the original (meaning formatting failed)
			if (
				!formattedCode ||
				formattedCode.trim() === '' ||
				formattedCode === block.code
			) {
				// Preserve the original block format - don't reformat it
				continue;
			}

			// Apply proper indentation
			const indentedCode = applyCommentIndentation(
				formattedCode,
				block,
				options,
			);

			// Replace the original code block
			const beforeBlock = processedText.substring(
				magicNumbers.zero,
				block.startPos,
			);
			const afterBlock = processedText.substring(block.endPos);

			// Reconstruct the block with formatted code
			// The block starts with {@code and ends with }
			// We need to add newlines and proper indentation
			const { tabWidth, useTabs } = options;
			const closingIndent =
				useTabs === true
					? '\t'.repeat(Math.floor(block.commentIndent / tabWidth))
					: ' '.repeat(block.commentIndent);

			// Reconstruct as: {@code\n   * formatted code\n   * }
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
	// Type guard to check if parsers object has expected structure
	const wrappedParsers: Record<string, ParserWithPreprocess | undefined> = {};
	for (const key in parsers) {
		if (Object.prototype.hasOwnProperty.call(parsers, key)) {
			const parser = parsers[key];
			// Create a new object by spreading to match ParserWithPreprocess shape
			wrappedParsers[key] = { ...parser } as ParserWithPreprocess;
		}
	}

	// Wrap each parser to chain preprocess functions
	for (const parserName in wrappedParsers) {
		const originalParser = wrappedParsers[parserName];
		if (originalParser && typeof originalParser === 'object') {
			const originalPreprocess = originalParser.preprocess;
			wrappedParsers[parserName] = {
				...originalParser,
				preprocess: async (
					text: Readonly<string>,
					options: Readonly<ParserOptions<ApexNode>>,
				): Promise<string> => {
					// First apply our preprocess
					let processed = await ourPreprocess(text, options);
					// Then apply original preprocess if it exists
					if (originalPreprocess) {
						const originalResult = originalPreprocess(
							processed,
							options,
						);
						processed =
							originalResult instanceof Promise
								? await originalResult
								: originalResult;
					}
					return processed;
				},
			};
		}
	}

	// Return the wrapped parsers - the type matches Plugin<ApexNode>['parsers']
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	return wrappedParsers as unknown as Plugin<ApexNode>['parsers'];
}

/**
 * prettier-plugin-apex-imo
 *
 * Extends prettier-plugin-apex to enforce multiline formatting for
 * Lists and Maps with 2+ entries, and formats code in ApexDoc {@code} blocks.
 */
// Helper to safely access plugin properties
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function getPluginProperty<T>(
	plugin: unknown,
	property: string,
): T | undefined {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	return (plugin as Record<string, unknown>)[property] as T | undefined;
}

const plugin: Plugin<ApexNode> = {
	// Re-export languages from apex plugin
	languages: getPluginProperty<Plugin<ApexNode>['languages']>(
		apexPlugin,
		'languages',
	),

	// Provide our wrapped printer
	printers: {
		apex: wrappedPrinter,
	},

	// Re-export options from apex plugin (if any)
	options: getPluginProperty<Plugin<ApexNode>['options']>(
		apexPlugin,
		'options',
	),

	// Re-export defaultOptions from apex plugin (if any)
	defaultOptions: getPluginProperty<Plugin<ApexNode>['defaultOptions']>(
		apexPlugin,
		'defaultOptions',
	),
};

// Wrap parsers to add our preprocess function
plugin.parsers = wrapParsers(
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	(apexPlugin as { parsers?: unknown }).parsers as
		| Plugin<ApexNode>['parsers']
		| undefined,
	plugin,
);

export default plugin;

// Named exports for ESM compatibility
export const { languages, parsers, printers, options, defaultOptions } = plugin;
