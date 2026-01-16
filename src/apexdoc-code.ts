/**
 * @file Functions for handling ApexDoc code blocks - extraction, formatting, and embed printer logic.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import type { ParserOptions } from 'prettier';
import * as prettier from 'prettier';
import type { Doc } from 'prettier';
import { NOT_FOUND_INDEX, removeCommentPrefix } from './comments.js';
import {
	EMPTY,
	INDEX_ONE,
	calculateEffectiveWidth,
	formatApexCodeWithFallback,
	preserveBlankLineAfterClosingBrace,
	docBuilders,
} from './utils.js';
import type { ApexDocCodeBlock } from './comments.js';

const CODE_TAG = '{@code';
const CODE_TAG_LENGTH = CODE_TAG.length;
const EMPTY_CODE_TAG = '{@code}';
const INITIAL_BRACE_COUNT = 1;
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
	while (pos < text.length && braceCount > EMPTY) {
		if (text[pos] === '{') {
			braceCount++;
		} else if (text[pos] === '}') {
			braceCount--;
			lastClosingBracePos = pos;
		}
		pos++;
	}
	if (braceCount !== EMPTY) {
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
	const FIRST_LINE_INDEX = 0;
	while (
		codeLines.length > 0 &&
		codeLines[FIRST_LINE_INDEX]?.trim().length === EMPTY
	) {
		codeLines.shift();
	}
	const LAST_LINE_INDEX = codeLines.length - 1;
	while (
		codeLines.length > 0 &&
		codeLines[LAST_LINE_INDEX]?.trim().length === EMPTY
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
		const prefix = index > EMPTY ? ' ' : '';
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
			willEndCodeBlock = codeBlockBraceCount === EMPTY;
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
			(index < lines.length - 1 ? trimmedLine : commentLine.trimStart())
		);
	});
};

/**
 * Shared logic for formatting code blocks with prettier.
 * @param normalizedCode - The normalized code to format.
 * @param optionsWithPlugin - Parser options with plugin configured.
 * @returns The formatted code string.
 */

/**
 * Processes embed result to extract formatted code lines.
 * @param embedResult - The embed result string to process.
 * @returns Array of extracted code lines.
 */
const extractCodeFromEmbedResult = (embedResult: string): string[] => {
	let embedContent = embedResult;
	if (embedContent.startsWith('/**\n')) {
		embedContent = embedContent.substring(COMMENT_PREFIX_LENGTH);
	}
	if (embedContent.endsWith('\n */\n')) {
		embedContent = embedContent.slice(0, -CLOSING_COMMENT_LENGTH);
	} else if (embedContent.endsWith('\n */')) {
		embedContent = embedContent.slice(0, -ALT_CLOSING_COMMENT_LENGTH);
	}

	const embedLines = embedContent.split('\n');
	const processedLines = embedLines.map((line: string) => {
		let start = 0;
		while (
			start < line.length &&
			(line[start] === ' ' || line[start] === '\t')
		) {
			start++;
		}
		if (start < line.length && line[start] === '*') {
			start++;
			if (start < line.length && line[start] === ' ') {
				start++;
			}
			return line.substring(start);
		}
		return line;
	});

	const codeStart = processedLines.findIndex(
		(line: string | undefined) => line != null && line.startsWith('{@code'),
	);
	const codeEnd = processedLines.findIndex(
		(line: string | undefined, i: number) =>
			i > codeStart && line != null && line === '}',
	);

	if (codeStart >= EMPTY && codeEnd > codeStart) {
		return processedLines
			.slice(codeStart + INDEX_ONE, codeEnd)
			.filter((line): line is string => typeof line === 'string');
	}

	return processedLines.slice(SKIP_FIRST_TWO_LINES);
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
	// Use extractCodeFromBlock instead of regex to extract code content
	if (!codeBlock.startsWith(CODE_TAG)) return [codeBlock];
	const extractResult = extractCodeFromBlock(codeBlock, 0);
	if (!extractResult) return [codeBlock];
	const codeContent = extractResult.code;
	if (codeContent.length === EMPTY) {
		return [codeBlock];
	}

	const codeLines = codeContent.split('\n');

	if (codeLines.length === INDEX_ONE) {
		const separator = codeContent.trim().endsWith(';') ? ' ' : '';
		return [`{@code ${codeContent}${separator}}`];
	}

	const embedResult = commentKey ? getFormattedCodeBlock(commentKey) : null;
	if (embedResult) {
		const extractedCodeLines = extractCodeFromEmbedResult(embedResult);
		return [`{@code`, ...extractedCodeLines, `}`];
	}

	return [`{@code`, ...codeLines, `}`];
}

/**
 * Creates an ApexDocCodeBlock from string code block data.
 * @param startPos - Start position of the code block.
 * @param endPos - End position of the code block.
 * @param rawCode - Raw code string extracted from the comment.
 * @param formattedCode - Optional formatted code string (if code was already formatted by embed function).
 * @returns The ApexDocCodeBlock object.
 */
const createDocCodeBlock = (
	startPos: number,
	endPos: number,
	rawCode: string,
	formattedCode?: string,
): ApexDocCodeBlock => {
	// Use formattedCode if available, otherwise use rawCode for Doc content
	const codeToUse = formattedCode ?? rawCode;
	const codeLines = codeToUse.split('\n');
	const { join, hardline } = docBuilders;
	const linesToDocLines = (lines: readonly string[]): Doc[] =>
		lines.map((line) => line as Doc);
	return {
		endPos,
		rawCode,
		startPos,
		type: 'code',
		...(formattedCode !== undefined ? { formattedCode } : {}),
		content:
			codeLines.length === 0
				? ('' as Doc)
				: codeLines.length === 1
					? (codeLines[0] as Doc)
					: join(hardline, [...linesToDocLines(codeLines)]),
	};
};

/**
 * Renders a code block in a comment string with proper formatting.
 * @param doc - The ApexDocCodeBlock to render.
 * @param commentPrefix - The comment prefix string (e.g., "  * ").
 * @returns Array of formatted lines for the code block.
 */
const renderCodeBlockInComment = (
	doc: ApexDocCodeBlock,
	commentPrefix: string,
): string[] => {
	const lines: string[] = [];
	// Use formatted code if available, otherwise use raw code
	const codeToUse = doc.formattedCode ?? doc.rawCode;
	// Handle empty code blocks - render {@code} even if content is empty
	const isEmptyBlock = codeToUse.trim().length === EMPTY;
	if (isEmptyBlock) {
		// Empty code block: render as {@code} on a single line
		lines.push(`${commentPrefix}{@code}`);
	} else {
		// Format code block with comment prefix
		// Split formatted code into lines and add prefix
		const codeLines = codeToUse.split('\n');
		const trimmedCommentPrefix = commentPrefix.trimEnd();
		for (const codeLine of codeLines) {
			lines.push(
				codeLine.trim().length === EMPTY
					? trimmedCommentPrefix
					: `${commentPrefix}${codeLine}`,
			);
		}
	}
	return lines;
};

/**
 * Processes all {@code} blocks in a comment text, formats them, and returns the formatted comment.
 * This is used by the Prettier embed function to process code blocks in comments.
 * @param root0 - The parameters object.
 * @param root0.commentText - The comment text containing {@code} blocks.
 * @param root0.options - Parser options.
 * @param root0.plugins - Array of plugins to use for formatting.
 * @param root0.commentPrefixLength - Length of the comment prefix (tabWidth + 3).
 * @param root0.setFormattedCodeBlock - Function to cache formatted code blocks.
 * @returns The formatted comment text with all code blocks processed, or undefined if no changes.
 */
const processAllCodeBlocksInComment = async ({
	commentText,
	options,
	plugins,
	commentPrefixLength,
	setFormattedCodeBlock,
}: {
	readonly commentText: string;
	readonly options: ParserOptions;
	readonly plugins: (prettier.Plugin<unknown> | URL | string)[];
	readonly commentPrefixLength: number;
	readonly setFormattedCodeBlock: (key: string, value: string) => void;
}): Promise<string | undefined> => {
	const printWidthValue = options.printWidth;
	const effectiveWidth = calculateEffectiveWidth(
		printWidthValue,
		commentPrefixLength,
	);

	let result = commentText;
	let startIndex = 0;
	let hasChanges = false;

	while ((startIndex = result.indexOf(CODE_TAG, startIndex)) !== -1) {
		// Use extractCodeFromBlock for proper brace-counting extraction
		const extraction = extractCodeFromBlock(result, startIndex);
		if (!extraction) {
			startIndex += CODE_TAG_LENGTH;
			continue;
		}

		const codeContent = extraction.code;

		// Format code using prettier.format to get a formatted string
		// Ensure our plugin is LAST in the plugins array so our wrapped printer
		// takes precedence over the base apex printers for shared parser names.
		let formattedCode = await formatApexCodeWithFallback(codeContent, {
			...options,
			plugins,
			printWidth: effectiveWidth,
		});

		// Annotations are normalized via AST during printing (see printAnnotation in annotations.ts)

		// Preserve blank lines: reinsert blank lines after } when followed by annotations or access modifiers
		// This preserves the structure from original code (blank lines after } before annotations/methods)
		const formattedLines = formattedCode.trim().split('\n');
		const resultLines: string[] = [];

		for (let i = 0; i < formattedLines.length; i++) {
			const formattedLine = formattedLines[i];
			if (formattedLine === undefined) continue;
			resultLines.push(formattedLine);
			// Insert blank line after } when followed by annotations or access modifiers
			if (
				preserveBlankLineAfterClosingBrace(
					formattedLines as readonly string[],
					i,
				)
			) {
				resultLines.push('');
			}
		}

		formattedCode = resultLines.join('\n');

		// Replace the code block with formatted version
		const beforeCode = result.substring(0, startIndex);
		const afterCode = result.substring(extraction.endPos);
		const formattedCodeLines = formattedCode.trim().split('\n');
		const prefixedCodeLines = formattedCodeLines.map((line) =>
			line ? ` * ${line}` : ' *',
		);
		const needsLeadingNewline = !beforeCode.endsWith('\n');
		const isEmptyBlock = codeContent.trim().length === 0;
		const newCodeBlock = isEmptyBlock
			? (needsLeadingNewline ? '\n' : '') + ` * ${CODE_TAG}}\n`
			: (needsLeadingNewline ? '\n' : '') +
				` * ${CODE_TAG}\n` +
				prefixedCodeLines.join('\n') +
				'\n * }\n';
		result = beforeCode + newCodeBlock + afterCode;
		hasChanges = true;
		startIndex = beforeCode.length + newCodeBlock.length;
	}

	if (!hasChanges) {
		return undefined;
	}

	// Store formatted comment in cache for retrieval by processApexDocCommentLines
	const codeTagPos = commentText.indexOf(CODE_TAG);
	if (codeTagPos !== -1) {
		setFormattedCodeBlock(
			`${String(commentText.length)}-${String(codeTagPos)}`,
			result,
		);
	}

	return result;
};

export {
	CODE_TAG,
	CODE_TAG_LENGTH,
	EMPTY_CODE_TAG,
	extractCodeFromBlock,
	processCodeBlock,
	processCodeBlockLines,
	processAllCodeBlocksInComment,
	createDocCodeBlock,
	renderCodeBlockInComment,
};
