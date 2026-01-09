/**
 * @file Functions for handling ApexDoc code blocks - extraction, formatting, and embed printer logic.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import * as prettier from 'prettier';
import type { ParserOptions } from 'prettier';
import { normalizeTypeNamesInCode } from './casing.js';
import {
	ARRAY_START_INDEX,
	STRING_OFFSET,
} from './comments.js';
import { normalizeAnnotationNamesInText } from './annotations.js';
import { FORMAT_FAILED_PREFIX } from './apexdoc.js';
import type { CodeBlockToken } from './comments.js';

const CODE_TAG = '{@code';
const CODE_TAG_LENGTH = CODE_TAG.length;
const EMPTY_CODE_TAG = '{@code}';
const INITIAL_BRACE_COUNT = 1;
const LAST_INDEX_OFFSET = 1;
const ZERO_LENGTH = 0;
const SINGLE_LINE_LENGTH = 1;
const SIMPLE_ANNOTATION_MAX_LENGTH = 100;
const NOT_FOUND_INDEX = -1;

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
	let lastClosingBracePos = NOT_FOUND_INDEX;
	while (pos < text.length && braceCount > ARRAY_START_INDEX) {
		if (text[pos] === '{') {
			braceCount++;
		} else if (text[pos] === '}') {
			braceCount--;
			lastClosingBracePos = pos;
		}
		pos++;
	}
	// If braces don't match but we found a closing brace, use it as the end position
	// This preserves invalid code blocks with unmatched brackets
	if (braceCount !== ARRAY_START_INDEX) {
		if (lastClosingBracePos !== NOT_FOUND_INDEX) {
			// Use the last closing brace position as the end, preserving the invalid code
			pos = lastClosingBracePos + STRING_OFFSET;
		} else {
			// No closing brace found, return null
			return null;
		}
	}
	const rawCode = text.substring(codeStart, pos - STRING_OFFSET);
	const code = rawCode.includes('*')
		? rawCode
				.split('\n')
				.map((line) => {
					// Remove comment asterisk prefix, preserving content indentation
					const afterAsterisk = line.replace(COMMENT_ASTERISK_REGEX, '');
					// Check if this is an empty line (only whitespace)
					if (afterAsterisk.trim() === '') {
						// This is an empty line - preserve it as empty string
						return '';
					}
					// Preserve content with its original indentation
					return afterAsterisk;
				})
				.join('\n')
		: rawCode;
	// Preserve blank lines: remove only leading/trailing blank lines, keep middle ones
	// Split into lines to process leading/trailing separately
	const codeLines = code.split('\n');
	// Remove leading blank lines
	while (codeLines.length > 0 && (codeLines[0]?.trim().length === 0)) {
		codeLines.shift();
	}
	// Remove trailing blank lines
	while (codeLines.length > 0 && (codeLines[codeLines.length - 1]?.trim().length === 0)) {
		codeLines.pop();
	}
	// Join back - middle blank lines are preserved
	const trimmedCode = codeLines.join('\n');
	return { code: trimmedCode, endPos: pos };
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

/**
 * Formats a CodeBlockToken using prettier with our plugin and effective page width.
 * @param token - The code block token to format.
 * @param effectiveWidth - The effective page width (reduced from printWidth).
 * @param embedOptions - Parser options for formatting.
 * @param currentPluginInstance - Plugin instance to ensure wrapped printer is used.
 * @returns Updated CodeBlockToken with formattedCode populated.
 */
const formatCodeBlockToken = async ({
	token,
	effectiveWidth,
	embedOptions,
	currentPluginInstance,
}: {
	readonly token: CodeBlockToken;
	readonly effectiveWidth: number;
	readonly embedOptions: ParserOptions;
	readonly currentPluginInstance: { default: unknown } | undefined;
}): Promise<CodeBlockToken> => {
	// Normalize annotations first
	const normalizedCode = normalizeAnnotationNamesInText(token.rawCode);

	// Use effective width for formatting
	const optionsWithPlugin = {
		...embedOptions,
		printWidth: effectiveWidth,
		plugins: [currentPluginInstance?.default ?? (await import('./index.js')).default],
	};

	let formatted;
	try {
		formatted = await prettier.format(normalizedCode, {
			...optionsWithPlugin,
			parser: 'apex-anonymous',
		});
	} catch {
		try {
			formatted = await prettier.format(normalizedCode, {
				...optionsWithPlugin,
				parser: 'apex',
			});
		} catch {
			formatted = `${FORMAT_FAILED_PREFIX}${normalizedCode}`;
		}
	}

	// Preserve blank lines: insert blank line after } when followed by annotations or access modifiers
	// This preserves the structure from original code (blank lines after } before annotations/methods)
	if (!formatted.startsWith(FORMAT_FAILED_PREFIX)) {
		const formattedLines = formatted.trim().split('\n');
		const resultLines: string[] = [];

		for (let i = 0; i < formattedLines.length; i++) {
			const formattedLine = formattedLines[i] ?? '';
			const trimmedLine = formattedLine.trim();
			resultLines.push(formattedLine);

			// Insert blank line after } when followed by annotations or access modifiers
			if (trimmedLine.endsWith('}') && i < formattedLines.length - 1) {
				const nextLine = formattedLines[i + 1]?.trim() ?? '';
				if (
					nextLine.length > 0 &&
					(nextLine.startsWith('@') ||
						/^(public|private|protected|static|final)\s/.test(nextLine))
				) {
					// Insert blank line to preserve structure from original
					resultLines.push('');
				}
			}
		}

		formatted = resultLines.join('\n');
	}

	return {
		...token,
		formattedCode: formatted.replace(/\n+$/, ''),
	};
};

/**
 * Formats {@code} block content for comment processing, returning formatted lines.
 * This is used when {@code} blocks are found during comment processing (not embed phase).
 * @param codeContent - The raw code content from inside {@code ... }
 * @param embedOptions - Parser options with reduced printWidth for comment context
 * @param currentPluginInstance - Plugin instance for formatting
 * @returns Array of formatted code lines (without comment prefixes)
 */
const formatCodeBlockForComment = async ({
	codeContent,
	embedOptions,
	currentPluginInstance,
}: {
	readonly codeContent: string;
	readonly embedOptions: ParserOptions;
	readonly currentPluginInstance: { default: unknown } | undefined;
}): Promise<readonly string[]> => {
	// Normalize annotations first
	const normalizedCode = normalizeAnnotationNamesInText(codeContent);

	// Format using prettier
	const optionsWithPlugin = {
		...embedOptions,
		plugins: [currentPluginInstance?.default ?? (await import('./index.js')).default],
	};

	let formatted;
	try {
		formatted = await prettier.format(normalizedCode, {
			...optionsWithPlugin,
			parser: 'apex-anonymous',
		});
	} catch {
		try {
			formatted = await prettier.format(normalizedCode, {
				...optionsWithPlugin,
				parser: 'apex',
			});
		} catch {
			formatted = `${FORMAT_FAILED_PREFIX}${normalizedCode}`;
		}
	}

	// Split into lines and return as array
	return formatted.replace(/\n+$/, '').split('\n');
};

export {
	CODE_TAG,
	CODE_TAG_LENGTH,
	EMPTY_CODE_TAG,
	extractCodeFromBlock,
	formatCodeBlockToken,
	formatCodeBlockForComment,
	processCodeBlockLines,
};
