/**
 * @file Functions for handling ApexDoc code blocks - extraction, formatting, and embed printer logic.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import * as prettier from 'prettier';
import type { ParserOptions } from 'prettier';
import { NOT_FOUND_INDEX, removeCommentPrefix } from './comments.js';
import { normalizeAnnotationNamesInText } from './annotations.js';
import { startsWithAccessModifier } from './utils.js';
import type { CodeBlockToken } from './comments.js';

const CODE_TAG = '{@code';
const CODE_TAG_LENGTH = CODE_TAG.length;
const EMPTY_CODE_TAG = '{@code}';
const INITIAL_BRACE_COUNT = 1;
const ZERO_LENGTH = 0;
const ONE_INDEX = 1;
const COMMENT_PREFIX_LENGTH = 4;
const CLOSING_COMMENT_LENGTH = 5;
const ALT_CLOSING_COMMENT_LENGTH = 4;
const SKIP_FIRST_TWO_LINES = 2;

/**
 * Extracts code from a code block by counting braces.
 * @param text - The text containing the code block.
 * @param startPos - The starting position of the code tag.
 * @returns The extracted code and end position, or null if extraction fails.
 * @example
 * extractCodeFromBlock('code block text', 0)
 */

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
	while (pos < text.length && braceCount > ZERO_LENGTH) {
		if (text[pos] === '{') {
			braceCount++;
		} else if (text[pos] === '}') {
			braceCount--;
			lastClosingBracePos = pos;
		}
		pos++;
	}
	if (braceCount !== ZERO_LENGTH) {
		if (lastClosingBracePos !== NOT_FOUND_INDEX) {
			// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- string position offset
			pos = lastClosingBracePos + 1;
		} else {
			return null;
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- string position offset
	const rawCode = text.substring(codeStart, pos - 1);
	const code = rawCode.includes('*')
		? rawCode
				.split('\n')
				.map((line) => {
					// Remove comment asterisk prefix, preserving content indentation
					const afterAsterisk = removeCommentPrefix(line, true);
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
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- array index
	while (codeLines.length > 0 && codeLines[0]?.trim().length === 0) {
		codeLines.shift();
	}
	while (
		codeLines.length > 0 &&
		// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- array index
		codeLines[codeLines.length - 1]?.trim().length === 0
	) {
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
const processCodeBlockLines = (lines: readonly string[]): readonly string[] => {
	let inCodeBlock = false;
	let codeBlockBraceCount = 0;

	return lines.map((commentLine, index) => {
		// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- array index
		const prefix = index > 0 ? ' ' : '';
		const trimmedLine = commentLine.trim();

		if (trimmedLine.startsWith(CODE_TAG)) {
			inCodeBlock = true;
			codeBlockBraceCount = INITIAL_BRACE_COUNT;
		}
		let willEndCodeBlock = false;

		if (inCodeBlock) {
			for (const char of trimmedLine) {
				if (char === '{') codeBlockBraceCount++;
				// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- brace count comparison
				else if (char === '}') codeBlockBraceCount--;
			}
			willEndCodeBlock = codeBlockBraceCount === ZERO_LENGTH;
		}

		if (inCodeBlock && !trimmedLine.startsWith(CODE_TAG)) {
			const trimmed = removeCommentPrefix(commentLine, true);
			if (willEndCodeBlock) {
				inCodeBlock = false;
			}
			return prefix + trimmed;
		}

		if (trimmedLine === '}') {
			return prefix + commentLine.trimStart();
		}
		return (
			prefix +
			(index < lines.length - 1
				? commentLine.trim()
				: commentLine.trimStart())
		);
	});
};

/**
 * Shared logic for formatting code blocks with prettier.
 * @param normalizedCode - The normalized code to format.
 * @param optionsWithPlugin - Parser options with plugin configured.
 * @returns The formatted code string.
 */
const formatCodeWithPrettier = async (
	normalizedCode: string,
	optionsWithPlugin: ParserOptions & { plugins: unknown[] },
): Promise<string> => {
	try {
		return await prettier.format(normalizedCode, {
			...optionsWithPlugin,
			parser: 'apex-anonymous',
		});
	} catch {
		try {
			return await prettier.format(normalizedCode, {
				...optionsWithPlugin,
				parser: 'apex',
			});
		} catch {
			// When parsing fails, preserve the original code as-is
			return normalizedCode;
		}
	}
};

/**
 * Preserves blank lines after closing braces when followed by annotations or access modifiers.
 * @param formatted - The formatted code string.
 * @returns The formatted code with blank lines preserved.
 */
const preserveBlankLinesAfterBraces = (formatted: string): string => {
	const formattedLines = formatted.trim().split('\n');
	const resultLines: string[] = [];

	for (let i = 0; i < formattedLines.length; i++) {
		const formattedLine = formattedLines[i] ?? '';
		const trimmedLine = formattedLine.trim();
		resultLines.push(formattedLine);

		// Insert blank line after } when followed by annotations or access modifiers
		if (trimmedLine.endsWith('}') && i < formattedLines.length - 1) {
			const nextLine = formattedLines[i + 1]?.trim() ?? '';
			// Check if next line starts with annotation or access modifier using Set-based detection
			if (
				nextLine.length > ZERO_LENGTH &&
				(nextLine.startsWith('@') || startsWithAccessModifier(nextLine))
			) {
				// Insert blank line to preserve structure from original
				resultLines.push('');
			}
		}
	}

	return resultLines.join('\n');
};

/**
 * Formats a CodeBlockToken using prettier with our plugin and effective page width.
 * @param root0 - The parameters object.
 * @param root0.token - The code block token to format.
 * @param root0.effectiveWidth - The effective page width (reduced from printWidth).
 * @param root0.embedOptions - Parser options for formatting.
 * @param root0.currentPluginInstance - Plugin instance to ensure wrapped printer is used.
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
	const normalizedCode = normalizeAnnotationNamesInText(token.rawCode);
	const optionsWithPlugin = {
		...embedOptions,
		plugins: [
			currentPluginInstance?.default ??
				(await import('./index.js')).default,
		],
		printWidth: effectiveWidth,
	};

	const formatted = await formatCodeWithPrettier(
		normalizedCode,
		optionsWithPlugin,
	);
	const formattedWithBlankLines = preserveBlankLinesAfterBraces(formatted);

	return {
		...token,
		formattedCode: formattedWithBlankLines.trimEnd(),
	};
};

/**
 * Processes a {&#64;code} block, returning formatted lines.
 * @param codeBlock - The code block text to process.
 * @param _options - Parser options (unused).
 * @param getFormattedCodeBlock - Function to get formatted code blocks.
 * @param commentKey - Key for the comment or null.
 * @param _embedOptions - Embed options (unused).
 * @returns Array of formatted lines.
 */
// eslint-disable-next-line @typescript-eslint/max-params
function processCodeBlock(
	codeBlock: string,
	_options: ParserOptions,
	getFormattedCodeBlock: (key: string) => string | undefined,
	commentKey: string | null,
	_embedOptions: ParserOptions,
): string[] {
	// Extract content between {@code and }
	const match = /^\{@code\s*([\s\S]*?)\s*\}$/.exec(codeBlock);
	if (!match) return [codeBlock];

	const [, codeContent] = match;
	if (codeContent === null || codeContent === undefined || !codeContent)
		return [codeBlock];

	const codeLines = codeContent.split('\n');

	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- single line check
	if (codeLines.length === ONE_INDEX) {
		// Single line - add space before closing } if content ends with ;
		const separator = codeContent.trim().endsWith(';') ? ' ' : '';
		return [`{@code ${codeContent}${separator}}`];
	} else {
		// Multi line - use embed result
		const embedResult = commentKey
			? getFormattedCodeBlock(commentKey)
			: null;

		if (embedResult != null) {
			// Parse embed result to extract the formatted code
			// Remove opening /** and closing */
			let embedContent = embedResult;
			if (embedContent.startsWith('/**\n')) {
				embedContent = embedContent.substring(COMMENT_PREFIX_LENGTH); // Remove '/**\n'
			}
			if (embedContent.endsWith('\n */\n')) {
				embedContent = embedContent.slice(0, -CLOSING_COMMENT_LENGTH);
			} else if (embedContent.endsWith('\n */')) {
				embedContent = embedContent.slice(
					0,
					-ALT_CLOSING_COMMENT_LENGTH,
				);
			}

			// Extract base indentation from the first code line (spaces before *)
			const embedLines = embedContent.split('\n');
			const processedLines = embedLines.map((line: string) => {
				// Remove the standard comment prefix but preserve relative indentation
				// Find first non-whitespace character
				let start = 0;
				while (
					start < line.length &&
					(line[start] === ' ' || line[start] === '\t')
				) {
					start++;
				}
				// If we found an asterisk, skip it and optional space
				if (start < line.length && line[start] === '*') {
					start++;
					// Skip optional space after asterisk
					if (start < line.length && line[start] === ' ') {
						start++;
					}
					return line.substring(start);
				}
				return line;
			});

			// Find the {@code block
			const codeStart = processedLines.findIndex(
				(line: string | undefined) =>
					line != null && line.startsWith('{@code'),
			);
			const codeEnd = processedLines.findIndex(
				(line: string | undefined, i: number) =>
					i > codeStart && line != null && line === '}',
			);

			if (codeStart >= 0 && codeEnd > codeStart) {
				const extractedCodeLines = processedLines
					.slice(codeStart + ONE_INDEX, codeEnd)
					.filter((line): line is string => typeof line === 'string');
				// For embed results, the formatted code is stored without comment prefixes
				// comments.ts will handle adding the proper indentation
				return [`{@code`, ...extractedCodeLines, `}`];
			}

			// Fallback
			return [
				`{@code`,
				...processedLines.slice(SKIP_FIRST_TWO_LINES),
				`}`,
			];
		} else {
			// Fallback to original format
			return [`{@code`, ...codeLines, `}`];
		}
	}
}

export {
	CODE_TAG,
	CODE_TAG_LENGTH,
	EMPTY_CODE_TAG,
	extractCodeFromBlock,
	formatCodeBlockToken,
	processCodeBlock,
	processCodeBlockLines,
};
