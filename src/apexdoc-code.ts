/**
 * @file Functions for handling ApexDoc code blocks - extraction, formatting, and embed printer logic.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import * as prettier from 'prettier';
import type { AstPath, Doc, ParserOptions } from 'prettier';
import type { ApexNode } from './types.js';
import {
	getIndentLevel,
	createIndent,
	ARRAY_START_INDEX,
	DEFAULT_TAB_WIDTH,
	STRING_OFFSET,
	MIN_INDENT_LEVEL,
} from './comments.js';

const CODE_TAG = '{@code';
const CODE_TAG_LENGTH = CODE_TAG.length;
const EMPTY_CODE_TAG = '{@code}';
const INITIAL_BRACE_COUNT = 1;
const NOT_FOUND_INDEX = -1;
const MATCH_GROUP_INDEX = 1;
const LAST_INDEX_OFFSET = 1;

/**
 * Extracts code from a code block by counting braces.
 * @param text - The text containing the code block.
 * @param startPos - The starting position of the code tag.
 * @returns The extracted code and end position, or null if extraction fails.
 * @example
 * extractCodeFromBlock('code block text', 0)
 */
const COMMENT_ASTERISK_REGEX = /^\s*(\*(\s*\*)*)\s*/;

const extractCodeFromBlock = (
	text: Readonly<string>,
	startPos: number,
): { code: string; endPos: number } | null => {
	const codeStart = prettier.util.skipWhitespace(
		text,
		startPos + CODE_TAG_LENGTH,
	) as number;
	let braceCount = INITIAL_BRACE_COUNT;
	let pos = codeStart;
	while (pos < text.length && braceCount > ARRAY_START_INDEX) {
		if (text[pos] === '{') braceCount++;
		else if (text[pos] === '}') braceCount--;
		pos++;
	}
	if (braceCount !== ARRAY_START_INDEX) return null;
	const rawCode = text.substring(codeStart, pos - STRING_OFFSET);
	const code = rawCode.includes('*')
		? rawCode
				.split('\n')
				.map((line) =>
					line.replace(COMMENT_ASTERISK_REGEX, '').trimStart(),
				)
				.join('\n')
		: rawCode;
	return { code: code.trim(), endPos: pos };
};

/**
 * Extracts code from wrapped formatted code between start and end markers.
 * @param params - Parameters object.
 * @param params.lines - The lines of formatted code.
 * @param params.tabWidth - The tab width for indentation calculation.
 * @param params.useTabs - Whether to use tabs for indentation.
 * @param params.startMarker - Marker to find start of code (e.g., 'public class Temp').
 * @param params.endMarker - Marker to find end of code (e.g., 'void method()').
 * @returns The extracted code lines.
 * @example
 * extractWrappedCode({lines: ['public class Temp {', '  @Test', '  void method() {}'], tabWidth: 2, useTabs: false, startMarker: 'public class Temp', endMarker: 'void method()'})
 */
const BRACE_REGEX = /\{/g;
const CLOSE_BRACE_REGEX = /\}/g;

const extractWrappedCode = ({
	lines,
	tabWidth,
	useTabs,
	startMarker,
	endMarker,
}: {
	readonly lines: readonly string[];
	readonly tabWidth: number;
	readonly useTabs: boolean | null | undefined;
	readonly startMarker: string;
	readonly endMarker: string;
}): string[] => {
	const codeLines: string[] = [];
	let baseIndent: number = ARRAY_START_INDEX;
	let braceCount = ARRAY_START_INDEX;
	let inCode = false;
	const indentOffset = tabWidth;
	for (const line of lines) {
		if (line.includes(startMarker)) {
			baseIndent = getIndentLevel(line, tabWidth);
			braceCount = INITIAL_BRACE_COUNT;
			inCode = true;
			continue;
		}
		if (line.includes(endMarker)) break;
		if (inCode) {
			const openBraces = (line.match(BRACE_REGEX) ?? []).length;
			const closeBraces = (line.match(CLOSE_BRACE_REGEX) ?? []).length;
			braceCount += openBraces - closeBraces;
			if (!braceCount && line.trim() === '}') break;
			const lineIndent = getIndentLevel(line, tabWidth);
			const indentDiff = lineIndent - baseIndent - indentOffset;
			const relativeIndent = Math.max(MIN_INDENT_LEVEL, indentDiff);
			codeLines.push(
				`${createIndent(relativeIndent, tabWidth, useTabs)}${line.trimStart()}`,
			);
		}
	}
	return codeLines;
};

/**
 * Extracts annotation code from formatted wrapped code.
 * @param lines - The lines of formatted code.
 * @param tabWidth - The tab width for indentation calculation.
 * @param useTabs - Whether to use tabs for indentation.
 * @returns The extracted annotation code lines.
 * @example
 * extractAnnotationCode(['public class Temp {', '  @Test', '  void method() {}'], 2, false)
 */
const extractAnnotationCode = (
	lines: readonly string[],
	tabWidth: number,
	useTabs: boolean | null | undefined,
): string[] =>
	extractWrappedCode({
		endMarker: 'void method()',
		lines,
		startMarker: 'public class Temp',
		tabWidth,
		useTabs,
	});

/**
 * Extracts method code from formatted wrapped code using brace counting.
 * @param lines - The lines of formatted code.
 * @param tabWidth - The tab width for indentation calculation.
 * @param useTabs - Whether to use tabs for indentation.
 * @returns The extracted method code lines.
 * @example
 * extractMethodCode(['void method() {', '  System.debug("test");', '}'], 2, false)
 */
const METHOD_MARKER = 'void method() {';

const extractMethodCode = (
	lines: readonly string[],
	tabWidth: number,
	useTabs: boolean | null | undefined,
): string[] => {
	const codeLines: string[] = [];
	let methodIndent: number = ARRAY_START_INDEX;
	let braceCount = ARRAY_START_INDEX;
	let inMethod = false;
	const indentOffset = tabWidth;
	for (const line of lines) {
		if (line.includes(METHOD_MARKER)) {
			methodIndent = getIndentLevel(line, tabWidth);
			inMethod = true;
			braceCount = INITIAL_BRACE_COUNT;
		} else if (inMethod) {
			const openBraces = (line.match(BRACE_REGEX) ?? []).length;
			const closeBraces = (line.match(CLOSE_BRACE_REGEX) ?? []).length;
			braceCount += openBraces - closeBraces;
			if (!braceCount && line.trim() === '}') break;
			const lineIndent = getIndentLevel(line, tabWidth);
			const indentDiff = lineIndent - methodIndent - indentOffset;
			const relativeIndent = Math.max(MIN_INDENT_LEVEL, indentDiff);
			codeLines.push(
				`${createIndent(relativeIndent, tabWidth, useTabs)}${line.trimStart()}`,
			);
		}
	}
	return codeLines;
};

const LEADING_WHITESPACE_REGEX = /^(\s*)/;

/**
 * Formats multiline code block with proper indentation and comment prefix.
 * Preserves brace alignment by tracking opening brace indentation.
 * @param formattedCode - The formatted code to prefix.
 * @param commentPrefix - The comment prefix (e.g., "   * ").
 * @returns The formatted code block with comment prefix.
 * @example
 * formatMultilineCodeBlock('  System.debug("test");', '   * ')
 */
const formatMultilineCodeBlock = (
	formattedCode: string,
	commentPrefix: string,
): string => {
	const lines = formattedCode.split('\n');
	const trimmedPrefix = commentPrefix.trimEnd();
	const nonEmptyLines = lines.filter(
		(line) => line.trim().length > ARRAY_START_INDEX,
	);
	const minIndent =
		nonEmptyLines.length > ARRAY_START_INDEX
			? Math.min(
					...nonEmptyLines.map((line) => {
						const match = LEADING_WHITESPACE_REGEX.exec(line);
						// eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- Need explicit null check for type safety
						return match !== null &&
							match[MATCH_GROUP_INDEX] !== undefined
							? match[MATCH_GROUP_INDEX].length
							: ARRAY_START_INDEX;
					}),
				)
			: ARRAY_START_INDEX;
	// Track nesting depth based on braces (more reliable than whitespace for Prettier-formatted code)
	// Start at depth 1 because we're inside the {@code block
	let braceDepth = 1;
	const prefixedLines = lines.map((line) => {
		const trimmedLine = line.trim();
		if (trimmedLine.length === ARRAY_START_INDEX) {
			return trimmedPrefix;
		}
		const leadingWhitespaceMatch = LEADING_WHITESPACE_REGEX.exec(line);
		const whitespaceLength =
			leadingWhitespaceMatch !== null
				? (leadingWhitespaceMatch[MATCH_GROUP_INDEX]?.length ??
					ARRAY_START_INDEX)
				: ARRAY_START_INDEX;
		
		// Calculate relative indentation from the minimum indent (preserves Prettier's formatting)
		// This is the primary source of indentation - Prettier formats code with proper indentation
		const relativeIndent = Math.max(
			ARRAY_START_INDEX,
			whitespaceLength - minIndent,
		);
		
		// Count braces to track nesting depth (for fallback when whitespace is missing)
		const openBraces = (trimmedLine.match(BRACE_REGEX) ?? []).length;
		const closeBraces = (trimmedLine.match(CLOSE_BRACE_REGEX) ?? []).length;
		
		// Calculate indentation:
		// 1. If Prettier formatted with whitespace, use relative indent (preserves Prettier's structure)
		// 2. If no whitespace (minIndent = 0), use brace-based indent as fallback
		// 3. Always ensure at least base indentation
		const TAB_WIDTH = 2;
		// Brace depth represents nesting level: 1 = inside {@code, 2 = inside class, 3 = inside method, etc.
		// Expected pattern: depth 1 = 1 additional space (total 2), depth 2 = 3 additional (total 4), depth 3 = 5 additional (total 6)
		// Formula: additional = (depth - 1) * TAB_WIDTH + 1
		// For depth 1: (1-1)*2 + 1 = 1
		// For depth 2: (2-1)*2 + 1 = 3
		// For depth 3: (3-1)*2 + 1 = 5
		const braceBasedIndent = (braceDepth - 1) * TAB_WIDTH + 1;
		
		// Use relative indent if available and meaningful (Prettier formatted with whitespace)
		// Otherwise fall back to brace-based indent
		// Prefer relative indent when it's greater than 0, as it preserves Prettier's exact formatting
		let codeIndent: number;
		if (relativeIndent > ARRAY_START_INDEX) {
			// Prettier formatted with whitespace - use it (preserves exact formatting)
			// But ensure it's at least 1 (base level should have 1 additional space)
			codeIndent = Math.max(1, relativeIndent);
		} else {
			// No whitespace from Prettier - use brace-based indent
			codeIndent = braceBasedIndent;
		}
		
		// Update brace depth AFTER calculating indent (for next line)
		braceDepth += openBraces - closeBraces;
		
		// Extract content, preserving any indentation that's part of the code structure
		// If minIndent > 0, we've already accounted for it in codeIndent, so strip it
		// Otherwise, preserve the original line structure
		let content: string;
		if (minIndent > ARRAY_START_INDEX) {
			// We've calculated relative indent, so strip the minIndent from the line
			content = line.substring(minIndent).trimStart();
		} else {
			// No minIndent means all lines start at column 0, so just trim
			// But preserve the structure - don't trim if it would remove meaningful whitespace
			content = line.trimStart();
		}
		
		// Add indentation for code blocks
		// commentPrefix is "   * " (includes 1 space after asterisk)
		// codeIndent is already calculated to include the base + relative indent
		// Expected pattern from output fixture:
		// - Base level (class): 2 spaces after asterisk (*   class) = 1 from prefix + 1 additional
		// - Method level: 4 spaces after asterisk (*     method) = 1 from prefix + 3 additional  
		// - Method body: 6 spaces after asterisk (*       return) = 1 from prefix + 5 additional
		// codeIndent already includes the base (1) + relative (0, 2, 4, etc.), so use it directly
		const codeIndentStr = ' '.repeat(codeIndent);
		return `${commentPrefix}${codeIndentStr}${content}`;
	});
	return `{@code\n${prefixedLines.join('\n')}\n${commentPrefix}}`;
};

/**
 * Formats a code block using Prettier's debug API or format function.
 * @param params - Parameters object.
 * @param params.code - The code to format.
 * @param params.isAnnotationCode - Whether this is annotation code.
 * @param params.textToDoc - Prettier's textToDoc function.
 * @param params.embedOptions - Parser options for formatting.
 * @param params.currentPluginInstance - Plugin instance for formatting fallback.
 * @returns The formatted code.
 * @example
 * formatCodeBlock({code: '@Test', isAnnotationCode: true, textToDoc: async (t, o) => {}, embedOptions: {}, currentPluginInstance: undefined})
 */
const formatCodeBlock = async ({
	code,
	isAnnotationCode,
	textToDoc,
	embedOptions,
	currentPluginInstance,
}: {
	readonly code: string;
	readonly isAnnotationCode: boolean;
	readonly textToDoc: (text: string, options: ParserOptions) => Promise<Doc>;
	readonly embedOptions: ParserOptions;
	readonly currentPluginInstance: { default: unknown } | undefined;
}): Promise<string> => {
	const wrappedCode = isAnnotationCode
		? `public class Temp { ${code} void method() {} }`
		: `public class Temp { void method() { ${code} } }`;

	const formattedWrappedDoc = await textToDoc(wrappedCode, {
		...embedOptions,
		parser: 'apex',
	});

	const debugApi = (
		prettier as {
			__debug?: {
				formatDoc?: (doc: Doc, options: ParserOptions) => string;
				printDocToString?: (
					doc: Doc,
					options: ParserOptions,
				) => Promise<{ formatted: string }>;
			};
		}
	).__debug;

	if (debugApi?.printDocToString) {
		const result = await debugApi.printDocToString(
			formattedWrappedDoc,
			embedOptions,
		);
		if (typeof result.formatted === 'string') {
			return result.formatted;
		}
	} else if (debugApi?.formatDoc) {
		return debugApi.formatDoc(formattedWrappedDoc, embedOptions);
	}

	const pluginToUse =
		currentPluginInstance?.default ?? (await import('./index.js')).default;
	return await prettier.format(wrappedCode, {
		...embedOptions,
		parser: 'apex',
		plugins: [pluginToUse as prettier.Plugin],
	});
};

/**
 * Extracts formatted code from wrapped formatted output.
 * @param params - Parameters object.
 * @param params.formattedWrapped - Wrapped code that has been formatted by Prettier.
 * @param params.isAnnotationCode - Whether this is annotation code.
 * @param params.tabWidth - Tab width for indentation.
 * @param params.useTabs - Use tabs instead of spaces for indentation.
 * @returns The extracted formatted code.
 * @example
 * extractFormattedCode({formattedWrapped: 'public class Temp { void method() {} }', isAnnotationCode: false, tabWidth: 2, useTabs: false})
 */
const extractFormattedCode = ({
	formattedWrapped,
	isAnnotationCode,
	tabWidth,
	useTabs,
}: {
	readonly formattedWrapped: string;
	readonly isAnnotationCode: boolean;
	readonly tabWidth: number;
	readonly useTabs: boolean | null | undefined;
}): string => {
	const lines = formattedWrapped.trim().split('\n');

	if (isAnnotationCode) {
		const codeLines = extractWrappedCode({
			endMarker: 'void method()',
			lines,
			startMarker: 'public class Temp',
			tabWidth,
			useTabs,
		});
		return codeLines.length > ARRAY_START_INDEX ? codeLines.join('\n') : '';
	}

	const codeLines = extractMethodCode(lines, tabWidth, useTabs);
	return codeLines.length > ARRAY_START_INDEX ? codeLines.join('\n') : '';
};

/**
 * Processes all code blocks in a comment and returns replacements.
 * @param params - Parameters object.
 * @param params.commentValue - The comment value containing code blocks.
 * @param params.textToDoc - Prettier's textToDoc function.
 * @param params.embedOptions - Parser options.
 * @param params.currentPluginInstance - Plugin instance for formatting fallback.
 * @returns Array of code block replacements.
 * @example
 * processCodeBlocks({commentValue: 'comment with code', textToDoc: async (t, o) => {}, embedOptions: {}, currentPluginInstance: undefined})
 */
const processCodeBlocks = async ({
	commentValue,
	textToDoc,
	embedOptions,
	currentPluginInstance,
}: {
	readonly commentValue: string;
	readonly textToDoc: (text: string, options: ParserOptions) => Promise<Doc>;
	readonly embedOptions: ParserOptions;
	readonly currentPluginInstance: { default: unknown } | undefined;
}): Promise<
	{
		end: number;
		formatted: string;
		start: number;
	}[]
> => {
	const replacements: {
		end: number;
		formatted: string;
		start: number;
	}[] = [];
	const tabWidth =
		typeof embedOptions.tabWidth === 'number'
			? embedOptions.tabWidth
			: DEFAULT_TAB_WIDTH;
	const useTabs: boolean | undefined =
		typeof embedOptions.useTabs === 'boolean'
			? embedOptions.useTabs
			: undefined;
	let searchPos = ARRAY_START_INDEX;

	while (searchPos < commentValue.length) {
		const tagPos = commentValue.indexOf(CODE_TAG, searchPos);
		if (tagPos === NOT_FOUND_INDEX) break;

		const extraction = extractCodeFromBlock(commentValue, tagPos);
		if (!extraction) {
			searchPos = tagPos + CODE_TAG_LENGTH;
			continue;
		}

		const { code, endPos } = extraction;
		const trimmedCode = code.trim();

		if (trimmedCode.length === ARRAY_START_INDEX) {
			replacements.push({ end: endPos, formatted: '', start: tagPos });
			searchPos = endPos;
			continue;
		}

		try {
			const isAnnotationCode = trimmedCode.startsWith('@');
			const formattedWrapped = await formatCodeBlock({
				code,
				currentPluginInstance,
				embedOptions,
				isAnnotationCode,
				textToDoc,
			});

			const formattedCode = extractFormattedCode({
				formattedWrapped,
				isAnnotationCode,
				tabWidth,
				useTabs,
			});

			replacements.push({
				end: endPos,
				formatted: formattedCode,
				start: tagPos,
			});
		} catch {
			// If formatting fails, skip this code block
		}

		searchPos = endPos;
	}

	return replacements;
};

/**
 * Applies code block replacements to a comment value.
 * @param commentValue - The original comment value.
 * @param replacements - Array of replacements to apply.
 * @returns The final comment with formatted code blocks.
 * @example
 * applyCodeBlockReplacements('comment', [{start: 4, end: 15, formatted: 'formatted'}])
 */
const applyCodeBlockReplacements = (
	commentValue: string,
	replacements: readonly {
		readonly end: number;
		readonly formatted: string;
		readonly start: number;
	}[],
): string => {
	if (replacements.length === ARRAY_START_INDEX) return commentValue;

	const firstLineMatch = /^(\s*)(\*)\s/m.exec(commentValue);
	const baseIndent = firstLineMatch?.[MATCH_GROUP_INDEX] ?? '';
	const commentPrefix = `${baseIndent} * `;
	let finalComment = commentValue;

	// Apply replacements in reverse order to maintain positions
	for (
		let i = replacements.length - LAST_INDEX_OFFSET;
		i >= ARRAY_START_INDEX;
		i--
	) {
		const replacement = replacements[i];
		if (replacement) {
			const before = finalComment.substring(
				ARRAY_START_INDEX,
				replacement.start,
			);
			const after = finalComment.substring(replacement.end);
			const trimmedFormatted = replacement.formatted.trim();
			const formattedWithPrefix = replacement.formatted.includes('\n')
				? formatMultilineCodeBlock(replacement.formatted, commentPrefix)
				: trimmedFormatted.length === ARRAY_START_INDEX
					? EMPTY_CODE_TAG
					: `{@code ${trimmedFormatted}}`;
			finalComment = before + formattedWithPrefix + after;
		}
	}

	return finalComment;
};

/**
 * Creates an embed function for handling code blocks in comments.
 * @param isCommentNode - Function to check if a node is a comment node.
 * @param currentPluginInstance - The current plugin instance for formatting.
 * @param formattedCodeBlocks - Map to store formatted code blocks.
 * @returns The embed function for Prettier.
 * @example
 * createCodeBlockEmbed(isCommentNode, pluginInstance, new Map())
 */
const createCodeBlockEmbed = (
	isCommentNode: (node: Readonly<ApexNode> | null | undefined) => boolean,
	currentPluginInstance: { default: unknown } | undefined,
	formattedCodeBlocks: Map<string, string>,
): ((path: unknown, options: unknown) => unknown) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prettier's embed types are complex
	const customEmbed: any = (path: any, _options: any): any => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- path.getNode() is a Prettier API
		const node = path.getNode() as ApexNode;

		// Check if this is a comment node with code blocks
		if (
			isCommentNode(node) &&
			'value' in node &&
			typeof node['value'] === 'string'
		) {
			const commentValue = node['value'];
			const codeTagPos = commentValue.indexOf(CODE_TAG);

			// If comment contains code blocks, return a function to handle them
			if (codeTagPos !== NOT_FOUND_INDEX) {
				// Create a unique key for this comment (using a simple hash of the value)
				// In a real implementation, we'd use node location or a better identifier
				const commentKey = `${String(commentValue.length)}-${String(codeTagPos)}`;

				return async (
					_textToDoc: (
						text: string,
						options: ParserOptions,
					) => Promise<Doc>,
					_print: (
						selector?:
							| (number | string)[]
							| AstPath
							| number
							| string,
					) => Doc,
					_embedPath: AstPath,
					_embedOptions: ParserOptions,
					// eslint-disable-next-line @typescript-eslint/max-params -- Prettier embed API requires 4 parameters
				): Promise<Doc | undefined> => {
					const replacements = await processCodeBlocks({
						commentValue,
						currentPluginInstance,
						embedOptions: _embedOptions,
						textToDoc: _textToDoc,
					});

					if (replacements.length > ARRAY_START_INDEX) {
						const finalComment = applyCodeBlockReplacements(
							commentValue,
							replacements,
						);
						// DEBUG: Test Hypothesis 27 - Check embed-formatted output
						if (commentKey.includes('complex-test-class') || finalComment.includes('ComplexIntegrationTest')) {
							const fs = require('fs');
							const debugLog = `[H27-EMBED] commentKey=${commentKey}\nfinalComment (first 2000 chars):\n${finalComment.substring(0, 2000)}\n---\n`;
							fs.appendFileSync('.cursor/debug.log', debugLog);
						}
						formattedCodeBlocks.set(commentKey, finalComment);
					}

					// Return undefined to let Prettier handle the comment normally
					// printComment will retrieve the formatted version
					return undefined;
				};
			}
		}

		return undefined;
	};

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Prettier's embed types are complex
	return customEmbed;
};

/**
 * Processes comment lines to handle code block boundaries.
 * Tracks code blocks using brace counting and preserves structure.
 * @param lines - The comment lines to process.
 * @returns The processed lines with code block structure preserved.
 * @example
 * processCodeBlockLines([' * code block line', ' *   System.debug("test");', ' * }'])
 */
const COMMENT_LINE_PREFIX_REGEX = /^\s*\*\s?/;

const processCodeBlockLines = (lines: readonly string[]): readonly string[] => {
	let inCodeBlock = false;
	let codeBlockBraceCount = ARRAY_START_INDEX;

	return lines.map((commentLine, index) => {
		const prefix = index > ARRAY_START_INDEX ? ' ' : '';
		const trimmedLine = commentLine.trim();

		if (trimmedLine.startsWith(CODE_TAG)) {
			inCodeBlock = true;
			codeBlockBraceCount = INITIAL_BRACE_COUNT;
		}
		let willEndCodeBlock = false;

		if (inCodeBlock) {
			for (const char of trimmedLine) {
				if (char === '{') codeBlockBraceCount++;
				else if (char === '}') codeBlockBraceCount--;
			}
			willEndCodeBlock = codeBlockBraceCount === ARRAY_START_INDEX;
		}

		if (inCodeBlock && !trimmedLine.startsWith(CODE_TAG)) {
			const trimmed = commentLine.replace(COMMENT_LINE_PREFIX_REGEX, '');
			if (willEndCodeBlock) {
				inCodeBlock = false;
			}
			return prefix + trimmed;
		}

		if (trimmedLine === '}') {
			return prefix + commentLine.trimStart();
		}
		if (index < lines.length - LAST_INDEX_OFFSET) {
			return prefix + commentLine.trim();
		}
		return prefix + commentLine.trimStart();
	});
};

export {
	CODE_TAG,
	CODE_TAG_LENGTH,
	EMPTY_CODE_TAG,
	extractCodeFromBlock,
	extractAnnotationCode,
	extractMethodCode,
	createCodeBlockEmbed,
	processCodeBlockLines,
};
