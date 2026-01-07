/**
 * @file Utility functions for finding and processing ApexDoc comments and their indentation.
 */

import type { ParserOptions, ApexNode } from './types.js';
import type { AstPath, Doc } from 'prettier';
import * as prettier from 'prettier';
import { normalizeSingleApexDocComment, processParagraphToken as processApexDocToken, processApexDocCommentLines } from './apexdoc.js';
import { processCodeBlockLines, formatCodeBlockForComment } from './apexdoc-code.js';

const COMMENT_START_MARKER = '/**';
const COMMENT_END_MARKER = '*/';
const COMMENT_START_LENGTH = COMMENT_START_MARKER.length;
const COMMENT_END_LENGTH = COMMENT_END_MARKER.length;
const MIN_INDENT_LEVEL = 0;
const DEFAULT_TAB_WIDTH = 2;
const ARRAY_START_INDEX = 0;
const STRING_OFFSET = 1;
const INDEX_ONE = 1;
const INDEX_TWO = 2;

const isCommentStart = (text: string, pos: number): boolean =>
	text.substring(pos, pos + COMMENT_START_LENGTH) === COMMENT_START_MARKER;

const getCommentEndLength = (text: string, pos: number): number => {
	// Check for standard */ first
	if (text.substring(pos, pos + COMMENT_END_LENGTH) === COMMENT_END_MARKER) {
		return COMMENT_END_LENGTH;
	}
	// Check for **/, ***/, etc.
	let asteriskCount = 0;
	let checkPos = pos;
	while (checkPos < text.length && text[checkPos] === '*') {
		asteriskCount++;
		checkPos++;
	}
	// Must have at least 2 asterisks and then a /
	if (
		asteriskCount >= INDEX_TWO &&
		checkPos < text.length &&
		text[checkPos] === '/'
	) {
		return asteriskCount + STRING_OFFSET; // asterisks + /
	}
	return ARRAY_START_INDEX; // Not a valid comment end
};

const findApexDocComments = (
	text: Readonly<string>,
): { start: number; end: number }[] => {
	const comments: { start: number; end: number }[] = [];
	for (let i = ARRAY_START_INDEX; i < text.length; i++) {
		if (isCommentStart(text, i)) {
			const start = i;
			for (
				i += COMMENT_START_LENGTH;
				i < text.length - STRING_OFFSET;
				i++
			) {
				const endLength = getCommentEndLength(text, i);
				if (endLength > ARRAY_START_INDEX) {
					comments.push({ end: i + endLength, start });
					i += endLength - STRING_OFFSET;
					break;
				}
			}
		}
	}
	return comments;
};

const getIndentLevel = (
	line: Readonly<string>,
	tabWidth: number = DEFAULT_TAB_WIDTH,
): number => {
	// Regex always matches (at minimum empty string), so exec() never returns null
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const [match] = /^[\t ]*/.exec(line)!;
	return match.replace(/\t/g, ' '.repeat(tabWidth)).length;
};

const createIndent = (
	level: Readonly<number>,
	tabWidth: Readonly<number>,
	useTabs?: Readonly<boolean | null | undefined>,
): string =>
	level <= MIN_INDENT_LEVEL
		? ''
		: useTabs === true
			? '\t'.repeat(Math.floor(level / tabWidth))
			: ' '.repeat(level);

const findLineStart = (text: string, pos: number): number => {
	let lineStart = pos;
	while (
		lineStart > ARRAY_START_INDEX &&
		text[lineStart - STRING_OFFSET] !== '\n'
	)
		lineStart--;
	return lineStart;
};

const getCommentIndent = (
	text: Readonly<string>,
	commentStart: number,
): number => {
	// Since commentStart is at / in /**, we know text[commentStart + 1] is *
	// skipToLineEnd returns commentStart, and skipNewline doesn't advance past it,
	// so we can always find the * at commentStart + 1
	const asteriskInCommentStart = commentStart + STRING_OFFSET;
	const lineStart = findLineStart(text, asteriskInCommentStart);
	return getIndentLevel(
		text.substring(lineStart, asteriskInCommentStart),
		DEFAULT_TAB_WIDTH,
	);
};


/**
 * Internal function to normalize basic block comment structure.
 * Handles malformed comments by normalizing markers, asterisks, and indentation.
 * @param commentValue - The comment text (e.g., comment block).
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @returns The normalized comment value.
 */
const normalizeBlockCommentBasic = (
	commentValue: Readonly<string>,
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): string => {
	const { tabWidth } = options;
	// Normalize comment markers first
	// 1. Normalize comment start: /***** -> /**
	let normalizedComment = commentValue.replace(/^(\s*)\/\*+/, '$1/**');
	// 2. Normalize comment end: **/ or more -> */ (preserve single */)
	// Match 2+ asterisks before / and normalize to */, handling optional trailing whitespace/newlines
	// Also handle cases where **/ appears in the middle of the comment (shouldn't happen, but be safe)
	normalizedComment = normalizedComment.replace(/\*{2,}\//g, '*/');
	// 3. Normalize lines with multiple asterisks: ** @param -> * @param
	// 4. Add asterisk to lines with no asterisk (but not the first line after /** or last line before */)
	const lines = normalizedComment.split('\n');
	const normalizedLines: string[] = [];
	const baseIndent = createIndent(commentIndent, tabWidth, options.useTabs);
	for (let i = ARRAY_START_INDEX; i < lines.length; i++) {
		const line = lines[i] ?? '';
		// Skip the first line (/**) and last line (*/)
		if (i === ARRAY_START_INDEX || i === lines.length - INDEX_ONE) {
			// Normalize comment end if it has extra asterisks
			if (i === lines.length - INDEX_ONE && line.includes('**/')) {
				normalizedLines.push(line.replace(/\*{2,}\//, '*/'));
			} else {
				normalizedLines.push(line);
			}
			continue;
		}
		// Check if line has asterisk(s) - match leading whitespace, then asterisk(s), then optional whitespace
		// Also handle lines that start with asterisk but have no leading whitespace (like "* @return")
		const asteriskMatch = /^(\s*)(\*+)(\s*)(.*)$/.exec(line);
		const asteriskMatchValue = asteriskMatch?.[ARRAY_START_INDEX];
		// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- asteriskMatchValue is string | undefined from regex exec
		if (asteriskMatchValue) {
			// Normalize multiple asterisks to single asterisk
			// Normalize indentation to match comment indent level
			// asteriskMatch groups: [0]=full match, [1]=leading whitespace, [2]=asterisks, [3]=whitespace after asterisks, [4]=rest of line
			// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Array index 4 for regex match group
			let restOfLine = asteriskMatch[4] ?? '';
			// Remove any leading asterisks (handle cases like "*   * @param" or "*** {@code")
			restOfLine = restOfLine.replace(/^\s*\*+\s*/, '');
			// Normal line - use consistent ' * ' spacing
			normalizedLines.push(`${baseIndent} * ${restOfLine.trimStart()}`);
		} else {
			// Line has no asterisk - add one with proper indentation
			// But check if line starts with asterisk but no leading whitespace (like "* @return")
			const trimmed = line.trimStart();
			if (trimmed.startsWith('*')) {
				// Line has asterisk but no leading whitespace - normalize it
				const afterAsterisk = trimmed.substring(INDEX_ONE).trimStart();
				normalizedLines.push(`${baseIndent} * ${afterAsterisk}`);
			} else {
				// Line truly has no asterisk - add one with proper indentation
				normalizedLines.push(`${baseIndent} * ${line.trimStart()}`);
			}
		}
	}
	normalizedComment = normalizedLines.join('\n');
	return normalizedComment;
};

/**
 * Normalizes a block comment to standard format.
 * Handles malformed comments by normalizing markers, asterisks, and indentation.
 * Optionally uses token-based system for paragraph wrapping.
 * @param commentValue - The comment text (e.g., comment block).
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth, useTabs, printWidth, and useTokenSystem.
 * @returns The normalized comment value.
 */
const normalizeBlockComment = (
	commentValue: Readonly<string>,
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
		readonly printWidth?: number;
		readonly useTokenSystem?: boolean;
	}>,
): string => {
	// If token system is requested and printWidth is available, use it
	if (
		options.useTokenSystem === true &&
		options.printWidth !== undefined &&
		options.printWidth > EMPTY
	) {
		// First normalize basic structure
		const basicNormalized = normalizeBlockCommentBasic(
			commentValue,
			commentIndent,
			{
				tabWidth: options.tabWidth,
				useTabs: options.useTabs,
			},
		);

		// Parse to tokens
		const tokens = parseCommentToTokens(basicNormalized);

		// Wrap paragraphs if needed
		const wrappedTokens = wrapParagraphTokens(
			tokens,
			options.printWidth,
			commentIndent,
			{
				tabWidth: options.tabWidth,
				useTabs: options.useTabs,
			},
		);

		// Convert back to string
		return tokensToCommentString(wrappedTokens, commentIndent, {
			tabWidth: options.tabWidth,
			useTabs: options.useTabs,
		});
	}

	// Use basic normalization (original implementation)
	return normalizeBlockCommentBasic(commentValue, commentIndent, {
		tabWidth: options.tabWidth,
		useTabs: options.useTabs,
	});
};

const EMPTY = 0;

// Token type definitions for comment processing
interface TextToken {
	readonly type: 'text';
	readonly content: string;
	readonly lines: readonly string[];
}

interface ParagraphToken {
	readonly type: 'paragraph';
	readonly content: string;
	readonly lines: readonly string[];
	readonly isContinuation: boolean;
}

interface CodeBlockToken {
	readonly type: 'code';
	readonly startPos: number;
	readonly endPos: number;
	readonly rawCode: string;
	readonly formattedCode?: string;
}

interface AnnotationToken {
	readonly type: 'annotation';
	readonly name: string;
	readonly content: string;
	readonly followingText?: string;
}

type CommentToken =
	| TextToken
	| ParagraphToken
	| CodeBlockToken
	| AnnotationToken;

/**
 * Parses a normalized comment string into basic tokens.
 * Detects paragraphs based on empty lines and continuation logic.
 * Also detects code blocks (pattern: slash-asterisk ... asterisk-slash).
 * @param normalizedComment - The normalized comment string.
 * @returns Array of tokens.
 */
const parseCommentToTokens = (
	normalizedComment: Readonly<string>,
): readonly CommentToken[] => {
	const lines = normalizedComment.split('\n');
	// Skip first line (/**) and last line (*/)
	if (lines.length <= INDEX_TWO) {
		return [];
	}
	const contentLines = lines.slice(INDEX_ONE, lines.length - INDEX_ONE);

	// Join content for code block detection
	const fullContent = contentLines.join('\n');

	// First detect /* ... */ code blocks (simple detection)
	// Scan for /* and */ patterns, but avoid matching /** or */
	const codeBlockPattern = /\/\*(?!\*)([\s\S]*?)\*\//g;
	const codeBlocks: Array<{ start: number; end: number; content: string }> =
		[];
	let match;
	// Reset regex lastIndex to ensure we start from the beginning
	codeBlockPattern.lastIndex = ARRAY_START_INDEX;
	while ((match = codeBlockPattern.exec(fullContent)) !== null) {
		const start = match.index ?? ARRAY_START_INDEX;
		const end = (match.index ?? ARRAY_START_INDEX) + (match[0]?.length ?? 0);
		const content = match[1] ?? '';
		codeBlocks.push({ start, end, content });
	}

	// Detect paragraphs based on empty lines and sentence boundaries
	// Skip code blocks when detecting paragraphs
	const tokens: CommentToken[] = [];
	let currentParagraph: string[] = [];
	let currentParagraphLines: string[] = [];
	let currentPos = ARRAY_START_INDEX;

	for (let i = ARRAY_START_INDEX; i < contentLines.length; i++) {
		const line = contentLines[i] ?? '';
		const lineStartPos = currentPos;
		const lineEndPos = currentPos + line.length;
		currentPos = lineEndPos + INDEX_ONE; // +1 for newline

		// Check if this line is inside a code block
		const isInCodeBlock = codeBlocks.some(
			(cb) => lineStartPos >= cb.start && lineEndPos <= cb.end,
		);

		if (isInCodeBlock) {
			// Finish current paragraph if any, then handle code block
			if (currentParagraph.length > EMPTY) {
				tokens.push({
					type: 'paragraph',
					content: currentParagraph.join(' '),
					lines: currentParagraphLines,
					isContinuation: false,
				} satisfies ParagraphToken);
				currentParagraph = [];
				currentParagraphLines = [];
			}
			// Find the code block this line belongs to
			const codeBlock = codeBlocks.find(
				(cb) => lineStartPos >= cb.start && lineEndPos <= cb.end,
			);
			if (codeBlock) {
				// Only add code block token once (on first line)
				const codeBlockStartLine = fullContent
					.substring(ARRAY_START_INDEX, codeBlock.start)
					.split('\n').length;
				if (i === codeBlockStartLine) {
					tokens.push({
						type: 'code',
						startPos: codeBlock.start,
						endPos: codeBlock.end,
						rawCode: codeBlock.content,
					} satisfies CodeBlockToken);
				}
			}
			continue;
		}

		// Remove comment prefix (*) to check if line is empty
		const trimmedLine = line.replace(/^\s*\*\s*/, '').trim();

		if (trimmedLine.length === EMPTY) {
			// Empty line - finish current paragraph if any
			if (currentParagraph.length > EMPTY) {
				tokens.push({
					type: 'paragraph',
					content: currentParagraph.join(' '),
					lines: currentParagraphLines,
					isContinuation: false,
				} satisfies ParagraphToken);
				currentParagraph = [];
				currentParagraphLines = [];
			}
			// Empty lines create paragraph boundaries but aren't tokens themselves
		} else {
			// Check if this line starts with @ (annotation)
			const isAnnotationLine = trimmedLine.startsWith('@');

			// If current line is an annotation, finish current paragraph first
			// But don't split if we're inside a {@code} block (contains {@code without matching })
			const currentContent = currentParagraph.join(' ');
			const hasUnclosedCodeBlock = (currentContent.match(/{@code/g) || []).length > (currentContent.match(/}/g) || []).length;

			if (isAnnotationLine && currentParagraph.length > EMPTY && !hasUnclosedCodeBlock) {
				tokens.push({
					type: 'paragraph',
					content: currentParagraph.join(' '),
					lines: currentParagraphLines,
					isContinuation: false,
				} satisfies ParagraphToken);
				currentParagraph = [];
				currentParagraphLines = [];
			}

			// Check for sentence boundary: ends with sentence-ending punctuation
			// and next line starts with capital letter
			const endsWithSentencePunctuation = /[.!?]\s*$/.test(trimmedLine);
			const nextLine = contentLines[i + INDEX_ONE];
			const nextTrimmed =
				nextLine !== undefined
					? nextLine.replace(/^\s*\*\s*/, '').trim()
					: '';
			const nextStartsWithCapital =
				nextTrimmed.length > EMPTY && /^[A-Z]/.test(nextTrimmed);

			// Add current line to paragraph
			currentParagraph.push(trimmedLine);
			currentParagraphLines.push(line);

			// If this is a sentence boundary or we're at an annotation line, finish current paragraph
			if (
				(endsWithSentencePunctuation &&
					nextStartsWithCapital &&
					nextTrimmed.length > EMPTY) ||
				isAnnotationLine
			) {
				tokens.push({
					type: 'paragraph',
					content: currentParagraph.join(' '),
					lines: currentParagraphLines,
					isContinuation: false,
				} satisfies ParagraphToken);
				currentParagraph = [];
				currentParagraphLines = [];
			}
		}
	}

	// Add last paragraph if any
	if (currentParagraph.length > EMPTY) {
		tokens.push({
			type: 'paragraph',
			content: currentParagraph.join(' '),
			lines: currentParagraphLines,
			isContinuation: false,
		} satisfies ParagraphToken);
	}

	// If no paragraphs were found, create a single text token
	if (tokens.length === EMPTY) {
		const content = contentLines.join('\n');
		return [
			{
				type: 'text',
				content,
				lines: contentLines,
			} satisfies TextToken,
		];
	}

	return tokens;
};

/**
 * Converts tokens back to a formatted comment string.
 * Uses wrapped paragraphs if they've been wrapped.
 * @param tokens - Array of comment tokens.
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @returns The formatted comment string.
 */
const tokensToCommentString = (
	tokens: readonly CommentToken[],
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): string => {
	const baseIndent = createIndent(
		commentIndent,
		options.tabWidth,
		options.useTabs,
	);
	const commentPrefix = `${baseIndent} * `;
	const lines: string[] = [`${baseIndent}/**`];

	for (const token of tokens) {
		if (token.type === 'text') {
			for (const line of token.lines) {
				// Preserve existing structure if line already has prefix
				if (line.trimStart().startsWith('*')) {
					lines.push(line);
				} else {
					lines.push(`${commentPrefix}${line.trimStart()}`);
				}
			}
		} else if (token.type === 'paragraph') {
			// Use wrapped lines if available, otherwise use original lines
			for (const line of token.lines) {
				if (line.trimStart().startsWith('*')) {
					lines.push(line);
				} else {
					lines.push(`${commentPrefix}${line.trimStart()}`);
				}
			}
		} else if (token.type === 'code') {
			// Use formatted code if available, otherwise use raw code
			const codeToUse = token.formattedCode ?? token.rawCode;
			if (codeToUse.length > EMPTY) {
				// Format code block with comment prefix
				// Split formatted code into lines and add prefix
				const codeLines = codeToUse.split('\n');
				for (const codeLine of codeLines) {
					if (codeLine.trim().length === EMPTY) {
						// Empty line - just comment prefix
						lines.push(commentPrefix.trimEnd());
					} else {
						lines.push(`${commentPrefix}${codeLine}`);
					}
				}
			}
		}
		// Annotation tokens will be handled later
	}

	lines.push(`${baseIndent} */`);
	return lines.join('\n');
};

/**
 * Wraps paragraph tokens based on effective page width.
 * Effective width accounts for comment prefix: printWidth - (baseIndent + ' * '.length)
 * @param tokens - Array of tokens (should be ParagraphTokens).
 * @param printWidth - The maximum line width.
 * @param baseIndent - The base indentation level in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @returns Array of wrapped paragraph tokens.
 */
const wrapParagraphTokens = (
	tokens: readonly CommentToken[],
	printWidth: number,
	baseIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): readonly ParagraphToken[] => {
	const commentPrefixLength = baseIndent + ' * '.length;
	const effectiveWidth = printWidth - commentPrefixLength;

	const wrappedTokens: ParagraphToken[] = [];

	for (const token of tokens) {
		if (token.type !== 'paragraph') {
			// For non-paragraph tokens, wrap them as-is (they'll be handled separately)
			continue;
		}

		const words = token.content.split(/\s+/);
		const wrappedLines: string[] = [];
		let currentLine: string[] = [];

		for (const word of words) {
			const testLine =
				currentLine.length === EMPTY
					? word
					: `${currentLine.join(' ')} ${word}`;

			if (testLine.length <= effectiveWidth) {
				currentLine.push(word);
			} else {
				// Line would exceed width, wrap it
				if (currentLine.length > EMPTY) {
					wrappedLines.push(currentLine.join(' '));
				}
				currentLine = [word];
			}
		}

		// Add last line if any
		if (currentLine.length > EMPTY) {
			wrappedLines.push(currentLine.join(' '));
		}

		// Create new paragraph token with wrapped lines
		// Need to reconstruct lines with comment prefix
		const baseIndentStr = createIndent(
			baseIndent,
			options.tabWidth,
			options.useTabs,
		);
		const commentPrefix = `${baseIndentStr} * `;
		const wrappedTokenLines = wrappedLines.map(
			(line) => `${commentPrefix}${line}`,
		);

		wrappedTokens.push({
			type: 'paragraph',
			content: wrappedLines.join(' '),
			lines: wrappedTokenLines,
			isContinuation: token.isContinuation,
		} satisfies ParagraphToken);
	}

	return wrappedTokens;
};

// Types for comment tokenization
export interface ParagraphToken {
	type: 'paragraph';
	content: string;
	isApexDoc: boolean;
}

export interface CodeBlockToken {
	type: 'code-block';
	content: string;
	isSingleLine: boolean;
}

export type CommentToken = ParagraphToken | CodeBlockToken;

/**
 * Processes an ApexDoc comment for printing, including embed formatting, normalization, and indentation.
 * @param commentValue - The raw comment value from the AST
 * @param options - Parser options
 * @param getCurrentOriginalText - Function to get the original source text
 * @param getFormattedCodeBlock - Function to get cached embed-formatted comments
 * @returns The processed comment ready for printing
 */
const processApexDocComment = (
	commentValue: string,
	options: ParserOptions,
	getCurrentOriginalText: () => string | undefined,
	getFormattedCodeBlock: (key: string) => string | undefined,
): string => {
	// Don't add base indentation, let Prettier handle it
	const commentIndent = 0;

	// Detect malformed comments BEFORE any processing
	const isMalformedComment = (() => {
		const lines = commentValue.split('\n');

		// Skip first and last lines (comment markers)
		for (let i = 1; i < lines.length - 1; i++) {
			const line = lines[i] ?? '';

			// Check for lines with multiple consecutive asterisks (**, ***, ****)
			if (/\*{2,}/.test(line)) {
				return true;
			}

			// Check for lines without asterisk prefix but with content
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('*') && trimmed.length > 0) {
				return true;
			}

			// Check for inconsistent spacing around asterisks
			// Look for patterns like "*   " (multiple spaces after *) or inconsistent spacing
			if (/^\s+\*\s{2,}/.test(line) || /^\s+\*\s*$/.test(line)) {
				return true;
			}
		}

		return false;
	})();

	if (isMalformedComment) {
		// Use normalization without embed system for malformed comments
		const normalizedComment = normalizeSingleApexDocComment(
			commentValue,
			commentIndent,
			options,
		);

		// Process code block lines
		const lines = normalizedComment.split('\n');
		const processedLines = processCodeBlockLines(lines);

		return processedLines.join('\n');
	}

	// For well-formed comments, delegate to apexdoc.ts to get formatted lines
	const formattedLines = processApexDocCommentLines(commentValue, commentIndent, options, getFormattedCodeBlock);

	// Add base indentation and comment prefix to each line
	const baseIndent = ' '.repeat(commentIndent);
	const indentedLines: string[] = [];

	for (const line of formattedLines) {
		if (line.trim() === '') {
			continue; // Skip empty lines
		} else {
			indentedLines.push(baseIndent + ' * ' + line);
		}
	}

	// Handle first and last lines specially
	if (indentedLines.length > 0) {
		indentedLines.unshift('/**');
		// Append the closing */ instead of replacing the last line
		// This preserves any } from {@code} blocks
		indentedLines.push(' */');
	}

	return indentedLines.join('\n');
};

/**
 * Tokenizes a comment into paragraph tokens.
 */
export function tokenizeCommentIntoParagraphs(commentValue: string): ParagraphToken[] {
	const lines = commentValue.split('\n');
	const tokens: ParagraphToken[] = [];

	// Remove /** and */ lines
	const contentLines = lines.slice(1, -1);

	// Group lines into paragraphs (separated by empty lines)
	let currentParagraph: string[] = [];

	for (const line of contentLines) {
		const trimmed = line.trim();
		if (trimmed === '' || trimmed === '*') {
			// Empty line or just *, end current paragraph
			if (currentParagraph.length > 0) {
				tokens.push({
					type: 'paragraph',
					content: currentParagraph.join('\n'),
					isApexDoc: currentParagraph.some(line => line.includes('@') || line.includes('{@code')),
				});
				currentParagraph = [];
			}
		} else {
			// Remove leading * and space
			const content = line.replace(/^\s*\*\s*/, '');
			currentParagraph.push(content);
		}
	}

	// Add final paragraph if any
	if (currentParagraph.length > 0) {
		tokens.push({
			type: 'paragraph',
			content: currentParagraph.join('\n'),
			isApexDoc: currentParagraph.some(line => line.includes('@')),
		});
	}

	return tokens;
}

/**
 * Processes a paragraph token, delegating to apexdoc.ts for ApexDoc content.
 */
function processParagraphToken(
	token: ParagraphToken,
	options: ParserOptions,
	getFormattedCodeBlock: (key: string) => string | undefined,
	commentKey: string | null,
): string[] {
	// Calculate reduced pageWidth for {@code} blocks (subtract comment indentation)
	const reducedPageWidth = Math.max(20, options.printWidth - 4); // 4 for " * " prefix
	const embedOptions = {
		...options,
		printWidth: reducedPageWidth,
	};

	// Use the imported function from apexdoc.js
	return processApexDocToken(token, options, getFormattedCodeBlock, commentKey, embedOptions);
}

/**
 * Custom printComment function that preserves our wrapped lines.
 * The original printApexDocComment trims each line, which removes our carefully
 * calculated wrapping. This version preserves the line structure we created.
 * @param path - The AST path to the comment node.
 * @param _options - Parser options (unused but required by Prettier API).
 * @param _print - Print function (unused but required by Prettier API).
 * @param _originalPrintComment - Original print comment function (unused but required by Prettier API).
 * @param options - Parser options for processing.
 * @param getCurrentOriginalText - Function to get the original source text.
 * @param getFormattedCodeBlock - Function to get cached embed-formatted comments.
 * @returns The formatted comment as a Prettier Doc.
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
	options: ParserOptions,
	getCurrentOriginalText: () => string | undefined,
	getFormattedCodeBlock: (key: string) => string | undefined,
	// eslint-disable-next-line @typescript-eslint/max-params -- Prettier printComment API requires parameters
): Doc => {
	const node = path.getNode();

	/**
	 * Check if this is an ApexDoc comment using the same logic as prettier-plugin-apex.
	 * But be more lenient: allow malformed comments (lines without asterisks) to be detected as ApexDoc
	 * if they start with / ** and end with * /.
	 * @param comment - The comment node to check.
	 * @returns True if the comment is an ApexDoc comment, false otherwise.
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

		// Process the ApexDoc comment using the centralized logic
		const processedComment = processApexDocComment(
			commentValue,
			options,
			getCurrentOriginalText,
			getFormattedCodeBlock,
		);

		// Return the processed comment as Prettier documents
		const lines = processedComment.split('\n');
		const { join, hardline } = prettier.doc.builders;
		return [join(hardline, lines)];
	}

	return '';
};

export {
	findApexDocComments,
	getIndentLevel,
	createIndent,
	getCommentIndent,
	normalizeBlockComment,
	parseCommentToTokens,
	tokensToCommentString,
	wrapParagraphTokens,
	processApexDocComment,
	customPrintComment,
	ARRAY_START_INDEX,
	DEFAULT_TAB_WIDTH,
	INDEX_ONE,
	INDEX_TWO,
	STRING_OFFSET,
	MIN_INDENT_LEVEL,
	EMPTY,
};
export type {
	CommentToken,
	TextToken,
	ParagraphToken,
	CodeBlockToken,
	AnnotationToken,
};
