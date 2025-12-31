/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
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
 * Normalize annotation option names within parameter content
 * Options can be: optionName=value or optionName value (space-separated)
 */
function normalizeAnnotationOptions(
	annotationName: string,
	paramContent: string,
): string {
	let result = paramContent;
	let searchPos = 0;
	const zero = 0;

	// Find option names (identifiers followed by = or whitespace)
	while (searchPos < result.length) {
		// Skip whitespace and commas
		while (searchPos < result.length && /[\s,]/.test(result[searchPos])) {
			searchPos++;
		}

		if (searchPos >= result.length) {
			break;
		}

		// Find the start of an option name (identifier character)
		const optionStart = searchPos;

		// Find the end of the option name (first non-identifier character)
		let optionEnd = optionStart;
		while (
			optionEnd < result.length &&
			/[a-zA-Z0-9_]/.test(result[optionEnd])
		) {
			optionEnd++;
		}

		if (optionEnd > optionStart) {
			const optionName = result.substring(optionStart, optionEnd);
			const normalizedOption = normalizeAnnotationOptionName(
				annotationName,
				optionName,
			);

			if (normalizedOption !== optionName) {
				// Replace option name
				result =
					result.substring(zero, optionStart) +
					normalizedOption +
					result.substring(optionEnd);
				// Continue from after the normalized option name
				searchPos = optionStart + normalizedOption.length;
			} else {
				// Skip to after the option name and its value
				// Option value can be: =value, ='value', =true, =false, or just whitespace
				searchPos = optionEnd;
				// Skip whitespace
				while (
					searchPos < result.length &&
					/\s/.test(result[searchPos])
				) {
					searchPos++;
				}
				// If there's an =, skip it and the value
				if (searchPos < result.length && result[searchPos] === '=') {
					searchPos++; // Skip =
					// Skip whitespace after =
					while (
						searchPos < result.length &&
						/\s/.test(result[searchPos])
					) {
						searchPos++;
					}
					// Skip the value (could be true, false, 'string', or identifier)
					if (searchPos < result.length) {
						if (result[searchPos] === "'") {
							// String value - find closing quote
							searchPos++;
							while (
								searchPos < result.length &&
								result[searchPos] !== "'"
							) {
								if (result[searchPos] === '\\') {
									searchPos++; // Skip escaped character
								}
								searchPos++;
							}
							if (searchPos < result.length) {
								searchPos++; // Skip closing quote
							}
						} else {
							// Boolean or identifier - find end (whitespace, comma, or end)
							while (
								searchPos < result.length &&
								!/[\s,]/.test(result[searchPos])
							) {
								searchPos++;
							}
						}
					}
				}
			}
		} else {
			searchPos++;
		}
	}

	return result;
}

/**
 * Normalize annotation names in text to PascalCase
 * Also normalizes annotation option names to camelCase
 * This allows the parser to handle incorrectly cased annotation names and options
 */
function normalizeAnnotationNamesInText(text: string): string {
	let result = text;
	let searchPos = 0;

	// Find all @ annotations and normalize their names and options
	const notFound = -1;
	const one = 1;
	const zero = 0;
	while (searchPos < result.length) {
		const atPos = result.indexOf('@', searchPos);
		if (atPos === notFound) {
			break;
		}

		// Find the end of the annotation name (first non-identifier character)
		let nameEnd = atPos + one;
		while (
			nameEnd < result.length &&
			/[a-zA-Z0-9_]/.test(result[nameEnd])
		) {
			nameEnd++;
		}

		// Extract annotation name
		const annotationName = result.substring(atPos + one, nameEnd);
		if (annotationName.length > zero) {
			// Normalize the annotation name
			const normalizedName = normalizeAnnotationName(annotationName);
			let annotationChanged = false;

			if (normalizedName !== annotationName) {
				// Replace with normalized name
				result =
					result.substring(zero, atPos + one) +
					normalizedName +
					result.substring(nameEnd);
				annotationChanged = true;
				// Update nameEnd to reflect the new length
				nameEnd = atPos + one + normalizedName.length;
			}

			// Now check if there are parameters (content between parentheses)
			// Skip whitespace after annotation name
			let paramStart = nameEnd;
			while (
				paramStart < result.length &&
				/\s/.test(result[paramStart])
			) {
				paramStart++;
			}

			// If we find an opening parenthesis, normalize options inside
			if (paramStart < result.length && result[paramStart] === '(') {
				// Find matching closing parenthesis
				let depth = 1;
				let paramEnd = paramStart + one;
				while (paramEnd < result.length && depth > zero) {
					if (result[paramEnd] === '(') {
						depth++;
					} else if (result[paramEnd] === ')') {
						depth--;
					}
					paramEnd++;
				}

				if (depth === zero) {
					// Extract parameter content (without parentheses)
					const paramContent = result.substring(
						paramStart + one,
						paramEnd - one,
					);

					// Normalize option names in the parameter content
					// Options are in the format: optionName=value or optionName value
					// We need to find option names (identifiers before = or whitespace)
					let normalizedParams = normalizeAnnotationOptions(
						normalizedName,
						paramContent,
					);

					if (normalizedParams !== paramContent) {
						// Replace parameter content
						result =
							result.substring(zero, paramStart + one) +
							normalizedParams +
							result.substring(paramEnd - one);
						annotationChanged = true;
						// Continue searching from after the closing parenthesis
						searchPos =
							paramStart + one + normalizedParams.length + one;
					} else {
						searchPos = paramEnd;
					}
				} else {
					searchPos = nameEnd;
				}
			} else {
				searchPos = nameEnd;
			}

			if (!annotationChanged) {
				searchPos = nameEnd;
			}
		} else {
			searchPos = atPos + one;
		}
	}

	return result;
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

		if (codeBlocks.length === magicNumbers.zero) {
			return processedText;
		}

		// Process blocks in reverse order to maintain positions
		// Format all blocks asynchronously
		// Note: processedText already has normalized annotations from above
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

			// If formatting failed (returned empty or threw), preserve original format
			if (!formattedCode || formattedCode.trim() === '') {
				// Preserve the original block format - don't reformat it
				continue;
			}

			// Check if formatting actually failed (formatCodeBlock caught an error)
			// formatCodeBlock returns "__FORMAT_FAILED__" + original code on error
			const FORMAT_FAILED_PREFIX = '__FORMAT_FAILED__';
			if (formattedCode.startsWith(FORMAT_FAILED_PREFIX)) {
				// Formatting failed (invalid code), preserve original block format
				continue;
			}

			// Check if formatting actually failed by comparing with original
			// If formattedCode === block.code, it means formatting didn't change the code
			// This could mean the code is invalid (formatCodeBlock caught an error and returned original)
			// OR the code is already correctly formatted
			// We need to distinguish: if the original block is already in the correct format
			// (code on new line), we can skip. Otherwise, we should format it.
			const originalBlockText = processedText.substring(
				block.startPos,
				block.endPos,
			);
			const isAlreadyFormatted = originalBlockText.includes('\n');

			// If formattedCode === block.code, it means formatting didn't change the code
			// This could be:
			// 1. Invalid code (formatCodeBlock caught an error and returned original) - preserve original block
			// 2. Valid code that's already correctly formatted - check if block structure is correct
			if (formattedCode === block.code) {
				// If the block is already formatted (has newlines), it's valid and correctly formatted
				if (isAlreadyFormatted) {
					// Code is already correctly formatted with proper block structure, skip
					continue;
				}
				// If the block is inline and code hasn't changed, we need to distinguish:
				// - Invalid code: should preserve as-is
				// - Valid code (e.g., normalized annotation): should format block structure
				// Since formatCodeBlock returns the original code on error, we can't easily distinguish
				// However, if the code was successfully parsed (no exception thrown), it's valid
				// and we should format the block structure. The only way to know if it failed
				// is if formatCodeBlock threw, but it catches and returns original.
				// For now, we'll format the block structure for inline blocks with unchanged code,
				// as this handles the annotation normalization case correctly.
				// Invalid code that can't be parsed will be preserved by the catch in formatCodeBlock
				// and we'll format the structure, but that's acceptable - invalid code in {@code}
				// blocks should ideally be formatted with proper structure too.
			}
			// If formattedCode !== block.code OR formattedCode === block.code but block is inline,
			// format the block structure to put code on new line

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
			// Always put code on a new line after {@code and before }
			// The block starts with {@code and ends with }
			// We need to add newlines and proper indentation
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
	// Type guard to check if parsers object has expected structure
	const wrappedParsers: Record<string, ParserWithPreprocess | undefined> = {};
	for (const key in parsers) {
		if (Object.prototype.hasOwnProperty.call(parsers, key)) {
			const parser = parsers[key];
			// Create a new object by spreading to match ParserWithPreprocess shape
			wrappedParsers[key] = { ...parser } as ParserWithPreprocess;
		}
	}

	// Wrap each parser to normalize annotations and chain preprocess functions
	for (const parserName in parsers) {
		if (Object.prototype.hasOwnProperty.call(parsers, parserName)) {
			// Get the original parser from the original parsers object (not the wrapped copy)
			const originalParserFromSource = parsers[parserName];
			const wrappedParser = wrappedParsers[parserName];
			// wrappedParser is always defined here because we only add keys from parsers
			if (wrappedParser) {
				const originalPreprocess = wrappedParser.preprocess;
				const originalParse = originalParserFromSource.parse;
				// Override both preprocess and parse to ensure normalization happens
				// Prettier calls preprocess first, but we also normalize in parse as a fallback
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
				wrappedParsers[parserName] = {
					...originalParserFromSource,
					parse: async (
						text: Readonly<string>,
						options: Readonly<ParserOptions<ApexNode>>,
					): Promise<ApexNode> => {
						// Normalize annotation names before parsing (fallback in case preprocess wasn't called)
						const normalizedText =
							normalizeAnnotationNamesInText(text);
						return await originalParse(normalizedText, options);
						throw new Error(
							'Original parser does not have parse method',
						);
					},
					preprocess: async (
						text: Readonly<string>,
						options: Readonly<ParserOptions<ApexNode>>,
					): Promise<string> => {
						// First apply original preprocess if it exists (just trims, synchronous)
						let processed = text;
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

						// Then normalize annotation names (must happen before parser sees them)
						// so incorrectly cased annotations are normalized
						processed = normalizeAnnotationNamesInText(processed);
						// Finally apply our preprocess (for ApexDoc code blocks, async)
						processed = await ourPreprocess(processed, options);
						return processed;
					},
				} as unknown as ParserWithPreprocess;
			}
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

// Create the plugin first (without wrapped parsers) so we can pass it to wrapParsers
// This allows formatCodeBlock to use our wrapped printer for List/Map formatting
const plugin: Plugin<ApexNode> = {
	// Re-export languages from apex plugin
	languages: getPluginProperty<Plugin<ApexNode>['languages']>(
		apexPlugin,
		'languages',
	),

	// Temporarily use original parsers - will be updated below
	parsers: getPluginProperty<Plugin<ApexNode>['parsers']>(
		apexPlugin,
		'parsers',
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

// Now wrap parsers with the actual plugin instance so formatCodeBlock can use our wrapped printer
const wrappedParsers = wrapParsers(
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	(apexPlugin as { parsers?: unknown }).parsers as
		| Plugin<ApexNode>['parsers']
		| undefined,
	plugin,
);

// Update the plugin with wrapped parsers
plugin.parsers = wrappedParsers;

export default plugin;

// Named exports for ESM compatibility
export const { languages, parsers, printers, options, defaultOptions } = plugin;
