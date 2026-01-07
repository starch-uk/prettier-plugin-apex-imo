/**
 * @file Functions for handling ApexDoc code blocks - extraction, formatting, and embed printer logic.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import * as prettier from 'prettier';
import type { ParserOptions } from 'prettier';
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
		if (text[pos] === '{') {
			braceCount++;
		} else if (text[pos] === '}') {
			braceCount--;
		}
		pos++;
	}
	if (braceCount !== ARRAY_START_INDEX) {
		return null;
	}
	const rawCode = text.substring(codeStart, pos - STRING_OFFSET);
	const code = rawCode.includes('*')
		? rawCode
				.split('\n')
				.map((line) => {
					// Check if this is an empty line (only asterisk(s) and whitespace)
					// After removing comment asterisks, if the line is empty, preserve it
					const afterAsterisk = line.replace(COMMENT_ASTERISK_REGEX, '').trimStart();
					if (afterAsterisk === '') {
						// This is an empty line - preserve it as empty string
						return '';
					}
					// Remove comment asterisk and leading whitespace, but preserve content
					return afterAsterisk;
				})
				.join('\n')
		: rawCode;
	const trimmedCode = code.trim();
	return { code: trimmedCode, endPos: pos };
};


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
	// CRITICAL: Remove trailing empty lines from formatted code
	// Prettier may add trailing newlines, which would create empty lines inside {@code} blocks
	// We want the code block to end immediately after the last non-empty line
	const trimmedFormattedCode = formattedCode.replace(/\n+$/, '');
	let lines = trimmedFormattedCode.split('\n');
	// Remove trailing empty lines from the array (in case split created empty strings)
	const EMPTY_LINE_LENGTH = 0;
	while (lines.length > ZERO_LENGTH && lines[lines.length - SINGLE_LINE_LENGTH]?.trim().length === EMPTY_LINE_LENGTH) {
		lines = lines.slice(ZERO_LENGTH, -SINGLE_LINE_LENGTH);
	}
	
	// Preserve exact indentation from embed output: baseIndent + '* ' + embedded line (with its indentation)
	const prefixedLines = lines.map((line) => {
		// Empty lines just get the comment prefix (no trailing space)
		if (line.trim().length === ZERO_LENGTH) {
			return commentPrefix.trimEnd();
		}
		
		// Preserve the exact indentation from the embed output
		// The line from embed already has the correct indentation (0, 2, 4, 6 spaces, etc.)
		// We just add the comment prefix before it
		return `${commentPrefix}${line}`;
	});
	
	return `{@code\n${prefixedLines.join('\n')}\n${commentPrefix.trimEnd()}}`;
};

/**
 * Formats a code block directly using Prettier's format with our plugin.
 * The code is extracted cleanly (no comment indentation) and formatted as-is.
 * @param params - Parameters object.
 * @param params.code - The cleanly extracted code to format (no comment prefixes).
 * @param params.embedOptions - Parser options for formatting.
 * @param params.currentPluginInstance - Plugin instance to ensure our wrapped printer is used.
 * @returns The formatted code with preserved relative indentation.
 * @example
 * formatCodeBlockDirect({code: '@IsTest\npublic void method() {}', embedOptions: {}, currentPluginInstance: undefined})
 */
const formatCodeBlockDirect = async ({
	code,
	embedOptions,
	currentPluginInstance,
}: {
	readonly code: string;
	readonly embedOptions: ParserOptions;
	readonly currentPluginInstance: { default: unknown } | undefined;
}): Promise<string> => {
	// Handle empty code blocks - return empty string immediately
	if (code.trim().length === ZERO_LENGTH) {
		return '';
	}
	
	// CRITICAL: Normalize annotations in the code before formatting
	// This is the ONLY place where annotations inside {@code} blocks are normalized
	// ApexDoc normalization (normalizeSingleApexDocComment) skips code block content entirely
	// This separation ensures:
	// 1. Code formatting is handled by embed function (Prettier)
	// 2. Annotation normalization for code blocks happens here (separate from ApexDoc normalization)
	// 3. ApexDoc normalization only processes annotations OUTSIDE code blocks
	// textToDoc should use our wrapped parser, but to be safe, we normalize here
	// This ensures annotations like @auraenabled become @AuraEnabled
	const normalizedCode = normalizeAnnotationNamesInText(code);
	
	// For single-line code blocks that are just bare annotations (without values),
	// normalize annotation names but don't try to format (they're not valid Apex code by themselves)
	// Annotations with values should be attempted to format (they may fail, which is expected for some)
	const trimmedNormalized = normalizedCode.trim();
	const isBareAnnotation = /^@\w+\s*$/.test(trimmedNormalized) && normalizedCode.split('\n').length === SINGLE_LINE_LENGTH;
	if (isBareAnnotation && trimmedNormalized.length < SIMPLE_ANNOTATION_MAX_LENGTH) {
		// For bare annotations (no values), normalize annotation names but return without formatting
		// Annotation normalization (PascalCase) is already applied by normalizeAnnotationNamesInText above
		return normalizedCode;
	}
	
	// CRITICAL: Use prettier.format with our plugin to ensure wrapped printer is used
	// This ensures annotation normalization, type normalization, and custom formatting are applied
	const pluginToUse =
		currentPluginInstance?.default ??
		(await import('./index.js')).default;
	
	// Create options with our plugin to ensure wrapped printer is used
	const optionsWithPlugin = {
		...embedOptions,
		plugins: [pluginToUse as prettier.Plugin],
	};
	
	// Try apex-anonymous parser first (designed for code snippets)
	// This handles both complete classes and incomplete code snippets
		try {
			const formatted = await prettier.format(normalizedCode, {
				...optionsWithPlugin,
				parser: 'apex-anonymous',
			});
			// Remove trailing newlines but preserve the formatted structure
			return formatted.replace(/\n+$/, '');
		} catch {
			// If apex-anonymous fails, try the regular apex parser
			try {
				const formatted = await prettier.format(normalizedCode, {
					...optionsWithPlugin,
					parser: 'apex',
				});
				// Remove trailing newlines but preserve the formatted structure
				return formatted.replace(/\n+$/, '');
			} catch {
				// If both parsers fail, return the code with FORMAT_FAILED prefix
				return `${FORMAT_FAILED_PREFIX}${normalizedCode}`;
			}
		}
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
 * Formats a CodeBlockToken using formatCodeBlockDirect with effective page width.
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
	// Use effective width for formatting
	const formattedCode = await formatCodeBlockDirect({
		code: token.rawCode,
		embedOptions: {
			...embedOptions,
			printWidth: effectiveWidth,
		},
		currentPluginInstance,
	});

	return {
		...token,
		formattedCode,
	};
};

export {
	CODE_TAG,
	CODE_TAG_LENGTH,
	EMPTY_CODE_TAG,
	extractCodeFromBlock,
	formatCodeBlockDirect,
	formatCodeBlockToken,
	formatMultilineCodeBlock,
	processCodeBlockLines,
};
