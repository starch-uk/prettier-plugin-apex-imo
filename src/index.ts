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
	let result = paramContent;
	let searchPos = 0;

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
					result.substring(0, optionStart) +
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
	while (searchPos < result.length) {
		const atPos = result.indexOf('@', searchPos);
		if (atPos === -1) {
			break;
		}

		// Find the end of the annotation name (first non-identifier character)
		let nameEnd = atPos + 1;
		while (
			nameEnd < result.length &&
			/[a-zA-Z0-9_]/.test(result[nameEnd])
		) {
			nameEnd++;
		}

		// Extract annotation name
		const annotationName = result.substring(atPos + 1, nameEnd);
		if (annotationName.length > 0) {
			// Normalize the annotation name
			const normalizedName = normalizeAnnotationName(annotationName);
			let annotationChanged = false;

			if (normalizedName !== annotationName) {
				// Replace with normalized name
				result =
					result.substring(0, atPos + 1) +
					normalizedName +
					result.substring(nameEnd);
				annotationChanged = true;
				// Update nameEnd to reflect the new length
				nameEnd = atPos + 1 + normalizedName.length;
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
				let paramEnd = paramStart + 1;
				while (paramEnd < result.length && depth > 0) {
					if (result[paramEnd] === '(') {
						depth++;
					} else if (result[paramEnd] === ')') {
						depth--;
					}
					paramEnd++;
				}

				if (depth === 0) {
					// Extract parameter content (without parentheses)
					const paramContent = result.substring(
						paramStart + 1,
						paramEnd - 1,
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
							result.substring(0, paramStart + 1) +
							normalizedParams +
							result.substring(paramEnd - 1);
						annotationChanged = true;
						// Continue searching from after the closing parenthesis
						searchPos =
							paramStart + 1 + normalizedParams.length + 1;
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
			searchPos = atPos + 1;
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
