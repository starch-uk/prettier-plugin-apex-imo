/**
 * @file Unified token-based processing system for ApexDoc comments.
 *
 * This module provides a consolidated approach to handling ApexDoc comments through:
 * - Token parsing and processing (async-first).
 * - Code block detection and formatting.
 * - Annotation normalization and wrapping.
 * - Integration with Prettier's document building system.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { ParserOptions, Doc } from 'prettier';
import * as prettier from 'prettier';
import {
	normalizeBlockComment,
	parseCommentToTokens,
	tokensToCommentString,
	wrapTextToWidth,
	CommentPrefix,
	isContentToken,
	NOT_FOUND_INDEX,
} from './comments.js';
import {
	ARRAY_START_INDEX,
	calculateEffectiveWidth,
	EMPTY,
	INDEX_ONE,
	isEmpty,
	isNotEmpty,
} from './utils.js';
import type {
	CommentToken,
	ContentToken,
	CodeBlockToken,
} from './comments.js';
import {
	detectAnnotationsInTokens,
	normalizeAnnotationTokens,
	wrapAnnotationTokens,
	renderAnnotationToken,
} from './apexdoc-annotations.js';
import {
	extractCodeFromBlock,
	EMPTY_CODE_TAG,
	CODE_TAG,
} from './apexdoc-code.js';
import { preserveBlankLineAfterClosingBrace } from './utils.js';
import { removeCommentPrefix } from './comments.js';

const ZERO_INDENT = 0;
const BODY_INDENT_WHEN_ZERO = 2;

/**
 * Calculates comment prefix and effective width for ApexDoc formatting.
 * Caches these calculations to avoid repeated computation.
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param printWidth - The print width option.
 * @param options - Options including tabWidth and useTabs.
 * @returns Object with commentPrefix, bodyIndent, actualPrefixLength, and effectiveWidth.
 */
const calculatePrefixAndWidth = (
	commentIndent: number,
	printWidth: number | undefined,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): {
	commentPrefix: string;
	bodyIndent: number;
	actualPrefixLength: number;
	effectiveWidth: number;
} => {
	const commentPrefix = CommentPrefix.create(commentIndent, options);
	const bodyIndent =
		commentIndent === ZERO_INDENT ? BODY_INDENT_WHEN_ZERO : ZERO_INDENT;
	const actualPrefixLength = commentPrefix.length + bodyIndent;
	const effectiveWidth = calculateEffectiveWidth(
		printWidth,
		actualPrefixLength,
	);
	return {
		actualPrefixLength,
		bodyIndent,
		commentPrefix,
		effectiveWidth,
	};
};

// Removed unused functions: isCommentStart and getCommentEndLength

interface CodeBlock {
	startPos: number;
	endPos: number;
	code: string;
	lineNumber: number;
	column: number;
	commentIndent: number;
}

// eslint-disable-next-line @typescript-eslint/no-type-alias -- Using utility type Readonly<T> per optimization plan to reduce duplication
type ReadonlyCodeBlock = Readonly<CodeBlock>;

/**
 * Normalizes a single ApexDoc comment value.
 * This function handles all normalization including annotation casing, spacing, and wrapping.
 * Normalizes a single ApexDoc comment by formatting annotations, code blocks, and text.
 * @param commentValue - The comment text (e.g., comment block).
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Parser options including printWidth, tabWidth, and useTabs.
 * @returns The normalized comment value.
 * @example
 * normalizeSingleApexDocComment('  * @param x The parameter', 2, { printWidth: 80, tabWidth: 2, useTabs: false })
 */
const normalizeSingleApexDocComment = (
	commentValue: Readonly<string>,
	commentIndent: number,
	options: Readonly<ParserOptions>,
): Doc => {
	const { printWidth, tabWidth } = options;
	const tabWidthValue = tabWidth;

	// Basic structure normalization - {@code} blocks are handled by the embed system
	let normalizedComment = normalizeBlockComment(commentValue, commentIndent, {
		tabWidth: tabWidthValue,
		useTabs: options.useTabs,
	});

	// Parse to tokens
	const { tokens: initialTokens } = parseApexDocTokens(
		normalizedComment,
		commentIndent,
		printWidth,
		{
			tabWidth: tabWidthValue,
			useTabs: options.useTabs,
		},
	);

	// Merge paragraph tokens that contain split {@code} blocks
	let tokens = mergeCodeBlockTokens(initialTokens);

	// Apply common token processing pipeline
	tokens = applyTokenProcessingPipeline(tokens, normalizedComment);

	// Cache prefix and width calculations (used in both wrapAnnotationTokens and tokensToApexDocString)
	const prefixAndWidth = printWidth
		? calculatePrefixAndWidth(commentIndent, printWidth, {
				tabWidth: tabWidthValue,
				useTabs: options.useTabs,
			})
		: null;

	// Wrap annotations if printWidth is available
	if (prefixAndWidth) {
		// Pass the actual prefix length to wrapAnnotationTokens so it can calculate first line width correctly
		tokens = wrapAnnotationTokens(
			tokens,
			prefixAndWidth.effectiveWidth,
			commentIndent,
			prefixAndWidth.actualPrefixLength,
			{
				tabWidth: tabWidthValue,
				useTabs: options.useTabs,
			},
		);
	}

	// Convert tokens back to string
	const commentString = tokensToApexDocString(
		tokens,
		commentIndent,
		{
			printWidth: printWidth,
			tabWidth: tabWidthValue,
			useTabs: options.useTabs,
		},
		prefixAndWidth,
	);

	// Convert the formatted comment string to Doc
	const lines = commentString.split('\n');
	const { join, hardline } = prettier.doc.builders;
	return join(hardline, lines);
};


/**
 * Processes code lines with blank line preservation.
 * @param codeToUse - The code string to process.
 * @returns Processed code with blank lines preserved.
 */
const processCodeLinesWithBlankLinePreservation = (
	codeToUse: string,
): string => {
	const codeLines = codeToUse.trim().split('\n');
	const resultLines: string[] = [];

	for (let i = ARRAY_START_INDEX; i < codeLines.length; i++) {
		if (i < ARRAY_START_INDEX || i >= codeLines.length) {
			continue;
		}
		const codeLine = codeLines[i];
		if (codeLine === undefined) continue;
		resultLines.push(codeLine);

		if (preserveBlankLineAfterClosingBrace(codeLines, i)) {
			resultLines.push('');
		}
	}

	return resultLines.join('\n');
};

/**
 * Handles already wrapped code blocks.
 * @param codeLinesForProcessing - Array of code lines to process.
 * @returns Processed code lines.
 */
const handleAlreadyWrappedCode = (
	codeLinesForProcessing: string[],
): string[] => {
	const finalCodeLines = codeLinesForProcessing;
	if (finalCodeLines.length === INDEX_ONE) {
		const [line] = finalCodeLines;
		if (line !== undefined && line.includes(';') && line.endsWith('}')) {
			// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- string slice position
			finalCodeLines[ARRAY_START_INDEX] = line.slice(0, -1) + ' }';
		}
	}
	return finalCodeLines;
};

/**
 * Handles unwrapped code blocks.
 * @param codeLinesForProcessing - Array of code lines to process.
 * @param commentPrefix - The comment prefix string.
 * @param printWidth - The print width option.
 * @returns Processed code lines with wrapping applied.
 */
const handleUnwrappedCode = (
	codeLinesForProcessing: string[],
	commentPrefix: string,
	printWidth: number,
): string[] => {
	const isSingleLine = codeLinesForProcessing.length === INDEX_ONE;
	const singleLineContent =
		codeLinesForProcessing.length > EMPTY &&
		codeLinesForProcessing[ARRAY_START_INDEX] !== undefined
			? codeLinesForProcessing[ARRAY_START_INDEX]?.trim() ?? ''
			: '';
	const singleLineWithBraces = `{@code ${singleLineContent} }`;
	const commentPrefixLength = commentPrefix.length;
	const fitsOnOneLine =
		singleLineWithBraces.length <= printWidth - commentPrefixLength;

	return isSingleLine && fitsOnOneLine
		? [singleLineWithBraces]
		: [`{@code`, ...codeLinesForProcessing, `}`];
};

/**
 * Builds final lines with comment prefixes.
 * @param finalCodeLines - Array of final code lines.
 * @param commentPrefix - The comment prefix string.
 * @returns Array of lines with prefixes applied.
 */
const buildLinesWithPrefixes = (
	finalCodeLines: string[],
	commentPrefix: string,
): string[] => {
	const trimmedCommentPrefix = commentPrefix.trimEnd();
	const lines: string[] = [];
	for (const codeLine of finalCodeLines) {
		lines.push(
			isEmpty(codeLine.trim())
				? trimmedCommentPrefix
				: `${commentPrefix}${codeLine}`,
		);
	}
	return lines;
};

/**
 * Renders a code block token to text token with formatted lines.
 * @param token - The code block token to render.
 * @param commentPrefix - The comment prefix string.
 * @param options - Options including printWidth.
 * @returns The rendered content token or null if empty.
 */
const renderCodeBlockToken = (
	token: CodeBlockToken,
	commentPrefix: string,
	options: Readonly<{
		readonly printWidth?: number;
	}>,
): ContentToken | null => {
	// Code blocks are formatted through Prettier which uses AST-based annotation normalization
	const codeToUse =
		token.formattedCode ?? token.rawCode;

	// Preserve blank lines: insert blank line after } when followed by annotations or access modifiers
	const processedCode = processCodeLinesWithBlankLinePreservation(codeToUse);
	const trimmedCodeToUse = processedCode.trim();
	const isEmptyBlock = isEmpty(trimmedCodeToUse);

	if (isEmptyBlock) {
		const lines = [`${commentPrefix}{@code}`];
		return {
			content: lines.join('\n'),
			lines,
			type: 'text',
		};
	}

	if (processedCode.length <= EMPTY) {
		return null;
	}

	const codeLinesForProcessing = processedCode.split('\n');
	const alreadyWrapped = trimmedCodeToUse.startsWith('{@code');
	const finalCodeLines = alreadyWrapped
		? handleAlreadyWrappedCode(codeLinesForProcessing)
		: (() => {
				if (options.printWidth === undefined) {
					throw new Error(
						'prettier-plugin-apex-imo: options.printWidth is required for renderCodeBlockToken',
					);
				}
				return handleUnwrappedCode(
					codeLinesForProcessing,
					commentPrefix,
					options.printWidth,
				);
			})();

	const lines = buildLinesWithPrefixes(finalCodeLines, commentPrefix);

	return isNotEmpty(lines)
		? {
				content: lines.join('\n'),
				lines,
				type: 'text',
			}
		: null;
};

/**
 * Renders a text or paragraph token with wrapping applied.
 * @param token - The content token to render.
 * @param commentPrefix - The comment prefix string.
 * @param effectiveWidth - The effective width for wrapping.
 * @param options - Options including tabWidth and useTabs.
 * @returns The rendered content token.
 */
const renderTextOrParagraphToken = (
	token: ContentToken,
	commentPrefix: string,
	effectiveWidth: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): ContentToken => {
	const wrappedLines = wrapTextContent(
		token.content,
		token.lines,
		effectiveWidth,
		options,
	);
	const allLines: string[] = [];
	for (const wrappedLine of wrappedLines) {
		allLines.push(...wrappedLine.split('\n'));
	}
	const cleanedLines = removeTrailingEmptyLines(allLines);
	const trimmedCommentPrefix = commentPrefix;
	const linesWithPrefix = cleanedLines.map(
		(line: string) => `${trimmedCommentPrefix}${line.trim()}`,
	);
	return {
		...token,
		content: cleanedLines.join('\n'),
		lines: linesWithPrefix,
	};
};

/**
 * Converts ApexDoc comment tokens (including AnnotationTokens) back into a
 * normalized comment string.
 * This function is ApexDoc-aware and knows how to render annotation tokens,
 * but defers the final comment construction (including the opening and closing
 * comment markers) to the
 * generic tokensToCommentString helper from comments.ts.
 * @param tokens - Array of comment tokens (may include AnnotationTokens).
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @param cachedPrefixAndWidth - Optional cached prefix and width calculations.
 * @returns The formatted ApexDoc comment string.
 */
const tokensToApexDocString = (
	tokens: readonly CommentToken[],
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
		readonly printWidth?: number;
	}>,
	cachedPrefixAndWidth?: ReturnType<typeof calculatePrefixAndWidth> | null,
): string => {
	const prefixAndWidth =
		cachedPrefixAndWidth ?? calculatePrefixAndWidth(commentIndent, options.printWidth, options);
	const { commentPrefix, effectiveWidth } = prefixAndWidth;

	const apexDocTokens: CommentToken[] = [];

	for (const token of tokens) {
		if (token.type === 'annotation') {
			const rendered = renderAnnotationToken(token, commentPrefix);
			if (rendered) apexDocTokens.push(rendered);
		} else if (token.type === 'code') {
			const rendered = renderCodeBlockToken(
				token,
				commentPrefix,
				options,
			);
			if (rendered) apexDocTokens.push(rendered);
		} else if (token.type === 'text' || token.type === 'paragraph') {
			apexDocTokens.push(
				renderTextOrParagraphToken(
					token,
					commentPrefix,
					effectiveWidth,
					options,
				),
			);
		} else {
			apexDocTokens.push(token);
		}
	}

	return tokensToCommentString(apexDocTokens, commentIndent, {
		tabWidth: options.tabWidth,
		useTabs: options.useTabs,
	});
};

/**
 * Removes trailing empty lines from an array of strings.
 * @param lines - Array of lines to clean.
 * @returns Array with trailing empty lines removed.
 */
const removeTrailingEmptyLines = (lines: readonly string[]): string[] => {
	const cleaned = [...lines];
	while (
		cleaned.length > 0 &&
		cleaned[cleaned.length - 1]?.trim().length === 0
	) {
		cleaned.pop();
	}
	return cleaned;
};

/**
 * Wraps text content to fit within effective width.
 * @param content - The text content to wrap.
 * @param originalLines - The original lines array (for reference).
 * @param effectiveWidth - The effective width available for content.
 * @param options - Options including tabWidth and useTabs.
 * @returns Array of wrapped lines (without comment prefix).
 */
const wrapTextContent = (
	content: string,
	originalLines: readonly string[],
	effectiveWidth: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): string[] => {
	// Extract content from lines (remove comment prefixes)
	if (content) {
		// Use unified wrapping function
		return wrapTextToWidth(content, effectiveWidth, options);
	}

	// Join lines intelligently: join unless:
	// 1. Current line ends with '.' (sentence boundary)
	// 2. Next line starts with capital letter (new sentence/paragraph)
	// 3. Next line is empty, annotation, or code block
	const cleanedLines = originalLines
		.map((line) => removeCommentPrefix(line))
		.filter((line) => isNotEmpty(line));

	const joinedParts: string[] = [];
	for (let i = ARRAY_START_INDEX; i < cleanedLines.length; i++) {
		const currentLine = cleanedLines[i]?.trim();
		if (currentLine === undefined) continue;
		const nextLine =
			i + INDEX_ONE < cleanedLines.length
				? cleanedLines[i + INDEX_ONE]?.trim() ?? ''
				: '';

		// Check if we should join with next line
		const currentEndsWithPeriod = currentLine.endsWith('.');
		const nextStartsWithCapital =
			nextLine.length > EMPTY && /^[A-Z]/.test(nextLine);
		const shouldJoin =
			!currentEndsWithPeriod &&
			!nextStartsWithCapital &&
			nextLine.length > EMPTY;

		if (shouldJoin && i < cleanedLines.length - INDEX_ONE) {
			// Join current and next line
			joinedParts.push(`${currentLine} ${nextLine}`);
			i++; // Skip next line since we joined it
		} else {
			joinedParts.push(currentLine);
		}
	}

	const textContent = joinedParts.join(' ');

	// Use unified wrapping function
	return wrapTextToWidth(textContent, effectiveWidth, options);
};

/**
 * Parses an ApexDoc comment into tokens and calculates effective page width.
 * Effective width accounts for comment prefix: printWidth - (baseIndent + ' * '.length)
 * @param normalizedComment - The normalized comment string.
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param printWidth - The maximum line width.
 * @param options - Options including tabWidth and useTabs.
 * @returns Object with tokens and effective page width.
 */
const parseApexDocTokens = (
	normalizedComment: Readonly<string>,
	commentIndent: number,
	printWidth: number,
	_options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): {
	readonly tokens: readonly CommentToken[];
	readonly effectiveWidth: number;
} => {
	const commentPrefixLength = CommentPrefix.getLength(commentIndent);
	const effectiveWidth = calculateEffectiveWidth(printWidth, commentPrefixLength);

	// Parse comment to tokens using the basic parser
	let tokens = parseCommentToTokens(normalizedComment);

	return {
		effectiveWidth,
		tokens,
	};
};

/**
 * Checks if content has a complete {@code} block starting at codeTagIndex.
 * @param content - The content to check.
 * @param codeTagIndex - The index where {@code starts.
 * @returns True if a complete block is found.
 */
const hasCompleteCodeBlock = (
	content: string,
	codeTagIndex: number,
): boolean => {
	let braceCount = 0;
	let searchPos = codeTagIndex;
	while (searchPos < content.length) {
		if (content[searchPos] === '{') {
			braceCount++;
		} else if (content[searchPos] === '}') {
			braceCount--;
			if (braceCount === 0) {
				return true;
			}
		}
		searchPos++;
	}
	return false;
};

/**
 * Creates a merged token from paragraph tokens.
 * @param token - The original content token.
 * @param mergedContent - The merged content string.
 * @param mergedLines - The merged lines array.
 * @returns The merged content token.
 */
const createMergedToken = (
	token: ContentToken,
	mergedContent: string,
	mergedLines: string[],
): ContentToken => {
	return {
		content: mergedContent,
		lines: mergedLines,
		type: 'paragraph',
		...(token.isContinuation !== undefined
			? {
					isContinuation: token.isContinuation,
				}
			: {}),
	};
};

/**
 * Attempts to merge tokens with incomplete code blocks.
 * @param token - The content token to merge.
 * @param codeTagIndex - The index where the code tag starts.
 * @param tokens - Array of all comment tokens.
 * @param startIndex - The starting index in the tokens array.
 * @returns Object with merged token and next index.
 */
const mergeIncompleteCodeBlock = (
	token: ContentToken,
	codeTagIndex: number,
	tokens: readonly CommentToken[],
	startIndex: number,
): { mergedToken: ContentToken | null; nextIndex: number } => {
	let mergedContent = token.content;
	let mergedLines = [...token.lines];
	let hasCompleteBlock = hasCompleteCodeBlock(mergedContent, codeTagIndex);
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- index increment
	let j = startIndex + INDEX_ONE;

	while (j < tokens.length && !hasCompleteBlock) {
		const nextToken = tokens[j];
		if (!nextToken) {
			j++;
			continue;
		}
		if (nextToken.type !== 'paragraph') {
			// Non-paragraph token, stop merging
			break;
		}

		const nextContent = nextToken.content;
		mergedContent += nextContent;
		mergedLines.push(...nextToken.lines);

		// Check if the merged content now has a complete block
		hasCompleteBlock = hasCompleteCodeBlock(mergedContent, codeTagIndex);

		if (hasCompleteBlock) {
			// Found complete block, create merged token
			const mergedToken = createMergedToken(
				token,
				mergedContent,
				mergedLines,
			);
			return { mergedToken, nextIndex: j };
		}
		j++;
	}

	return { mergedToken: null, nextIndex: startIndex };
};

/**
 * Merges paragraph tokens that contain split {@code} blocks to ensure complete blocks are in single tokens.
 * @param tokens - Array of comment tokens.
 * @returns Array of tokens with merged {@code} blocks.
 */
const mergeCodeBlockTokens = (
	tokens: readonly CommentToken[],
): readonly CommentToken[] => {
	const mergedTokens: CommentToken[] = [];
	let i = 0;

	while (i < tokens.length) {
		const token = tokens[i];
		if (!token) {
			i++;
			continue;
		}

		if (token.type !== 'paragraph') {
			// Non-paragraph token, add as-is
			mergedTokens.push(token);
			i++;
			continue;
		}

		const content = token.content;
		const codeTagIndex = content.indexOf('{@code');

		if (codeTagIndex === -1) {
			// No {@code} tag, add as-is
			mergedTokens.push(token);
			i++;
			continue;
		}

		// Check if this token contains a complete {@code} block
		const hasCompleteBlock = hasCompleteCodeBlock(content, codeTagIndex);

		if (hasCompleteBlock) {
			// Complete block in single token
			mergedTokens.push(token);
			i++;
			continue;
		}

		// Need to merge with subsequent tokens
		const mergeResult = mergeIncompleteCodeBlock(token, codeTagIndex, tokens, i);
		if (mergeResult.mergedToken) {
			mergedTokens.push(mergeResult.mergedToken);
			i = mergeResult.nextIndex + 1;
		} else {
			// Couldn't find complete block, add original token
			mergedTokens.push(token);
			i++;
		}
	}

	return mergedTokens;
};

/**
 * Checks if a paragraph content contains ApexDoc-specific elements like annotations or code blocks.
 * @param content - The paragraph content to check.
 * @returns True if the content contains ApexDoc elements.
 */

/**
 * Applies the common token processing pipeline: code block detection, annotation detection, and normalization.
 * @param tokens - Array of comment tokens.
 * @param normalizedComment - The normalized comment text (may be undefined in async contexts).
 * @returns Array of processed tokens.
 */
const applyTokenProcessingPipeline = (
	tokens: readonly CommentToken[],
	normalizedComment?: string,
): readonly CommentToken[] => {
	// Detect code blocks first to separate {@code} content from regular text
	let processedTokens = detectCodeBlockTokens(
		tokens,
		normalizedComment !== undefined ? normalizedComment : '',
	);

	// Detect annotations in tokens that contain ApexDoc content
	// Code blocks are now handled as separate tokens
	processedTokens = detectAnnotationsInTokens(
		processedTokens,
		normalizedComment !== undefined ? normalizedComment : '',
	);

	// Normalize annotations
	processedTokens = normalizeAnnotationTokens(processedTokens);

	return processedTokens;
};


/**
 * Extracts prefix from paragraph token lines.
 * @param token - The content token to extract prefix from.
 * @returns The extracted prefix string.
 */
const extractPrefixFromParagraphToken = (
	token: ContentToken,
): string => {
	const firstLineWithPrefix = token.lines.find((line: string) => {
		const trimmed = line.trimStart();
		return trimmed.length > EMPTY && trimmed.startsWith('*');
	});
	if (!firstLineWithPrefix) {
		return ' * '; // Default fallback
	}
	const prefixMatch = /^(\s*\*\s*)/.exec(firstLineWithPrefix);
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- array index for regex match
	return prefixMatch?.[INDEX_ONE] ?? ' * ';
};

/**
 * Creates a text token from cleaned text for paragraph tokens.
 * @param cleanedText - The cleaned text content.
 * @param token - The content token.
 * @returns The created text token or null if empty.
 */
const createTextTokenFromParagraph = (
	cleanedText: string,
	token: ContentToken,
): ContentToken | null => {
	const prefix = extractPrefixFromParagraphToken(token);
	const splitLines = cleanedText
		.split('\n')
		.filter((line: string) => line.trim().length > EMPTY);
	if (splitLines.length === EMPTY) {
		return null;
	}
	return {
		content: cleanedText,
		lines: splitLines.map((line: string) => `${prefix}${line.trim()}`),
		type: 'text',
	} satisfies ContentToken;
};

/**
 * Creates a text token from cleaned text for text tokens.
 * @param cleanedText - The cleaned text content.
 * @returns The created text token or null if empty.
 */
const createTextTokenFromText = (
	cleanedText: string,
): ContentToken | null => {
	const splitLines = cleanedText.split('\n');
	const cleanedLines = removeTrailingEmptyLines(splitLines);
	if (cleanedLines.length === EMPTY) {
		return null;
	}
	return {
		content: cleanedText,
		lines: cleanedLines,
		type: 'text',
	} satisfies ContentToken;
};

/**
 * Processes remaining text after last code tag.
 * @param content - The content string.
 * @param currentPos - The current position in content.
 * @param token - The content token.
 * @param newTokens - Array to add new tokens to.
 */
const processRemainingText = (
	content: string,
	currentPos: number,
	token: ContentToken,
	newTokens: CommentToken[],
): void => {
	if (currentPos >= content.length) {
		return;
	}
	const remainingText = content.substring(currentPos);
	if (remainingText.length <= EMPTY) {
		return;
	}
	const cleanedText = remainingText.trimEnd();
	if (cleanedText.length <= EMPTY) {
		return;
	}

	const textToken =
		token.type === 'paragraph'
			? createTextTokenFromParagraph(cleanedText, token)
			: createTextTokenFromText(cleanedText);
	if (textToken) {
		newTokens.push(textToken);
	}
};

/**
 * Processes text before code tag.
 * @param content - The content string.
 * @param lastMatchEnd - The end position of last match.
 * @param codeTagStart - The start position of code tag.
 * @param token - The content token.
 * @param newTokens - Array to add new tokens to.
 */
const processTextBeforeCode = (
	content: string,
	lastMatchEnd: number,
	codeTagStart: number,
	token: ContentToken,
	newTokens: CommentToken[],
): void => {
	if (codeTagStart <= lastMatchEnd) {
		return;
	}
	const textBeforeCode = content.substring(lastMatchEnd, codeTagStart);
	if (textBeforeCode.length <= EMPTY) {
		return;
	}
	const cleanedText = textBeforeCode.trimEnd();
	if (cleanedText.length <= EMPTY) {
		return;
	}

	const textToken =
		token.type === 'paragraph'
			? createTextTokenFromParagraph(cleanedText, token)
			: createTextTokenFromText(cleanedText);
	if (textToken) {
		newTokens.push(textToken);
	}
};

/**
 * Processes content token to detect code blocks.
 * @param token - The content token to process.
 * @param newTokens - Array to add new tokens to.
 */
const processContentTokenForCodeBlocks = (
	token: ContentToken,
	newTokens: CommentToken[],
): void => {
	// For content tokens, work with the lines array to preserve line breaks
	// Off-by-one fix: only remove " *" or " * " (asterisk + optional single space), preserve extra indentation spaces
	// Match /^\s*\*\s?/ to remove asterisk and at most one space, preserving code block indentation
	const content =
		token.type === 'paragraph'
			? token.lines
					.map((line: string) => line.replace(/^\s*\*\s?/, ''))
					.join('\n')
			: token.lines.join('\n');
	let currentPos = ARRAY_START_INDEX;
	let lastMatchEnd = ARRAY_START_INDEX;

	while (currentPos < content.length) {
		const codeTagStart = content.indexOf(CODE_TAG, currentPos);

		if (codeTagStart === NOT_FOUND_INDEX) {
			processRemainingText(content, currentPos, token, newTokens);
			break;
		}

		processTextBeforeCode(
			content,
			lastMatchEnd,
			codeTagStart,
			token,
			newTokens,
		);

		const codeBlockResult = extractCodeFromBlock(content, codeTagStart);
		if (codeBlockResult) {
			newTokens.push({
				endPos: codeBlockResult.endPos,
				rawCode: codeBlockResult.code,
				startPos: codeTagStart,
				type: 'code',
			} satisfies CodeBlockToken);
			currentPos = codeBlockResult.endPos;
			lastMatchEnd = codeBlockResult.endPos;
		} else {
			currentPos = codeTagStart + CODE_TAG.length;
			lastMatchEnd = currentPos;
		}
	}
};

/**
 * Detects code blocks in tokens by scanning for {@code} patterns.
 * Converts TextToken/ParagraphToken content containing {@code} to CodeBlockTokens.
 * @param tokens - Array of comment tokens.
 * @param _originalComment - The original comment string for position tracking (unused but kept for API compatibility).
 * @returns Array of tokens with code blocks detected.
 */
const detectCodeBlockTokens = (
	tokens: readonly CommentToken[],
	_originalComment: Readonly<string>,
): readonly CommentToken[] => {
	const newTokens: CommentToken[] = [];

	for (const token of tokens) {
		if (isContentToken(token)) {
			processContentTokenForCodeBlocks(token, newTokens);
		} else {
			newTokens.push(token);
		}
	}
	return newTokens;
};


export {
	EMPTY_CODE_TAG,
	normalizeSingleApexDocComment,
	detectCodeBlockTokens,
	removeTrailingEmptyLines,
};

/**
 * Processes an ApexDoc comment for printing, including embed formatting, normalization, and indentation.
 * @param commentValue - The raw comment value from the AST
 * @param options - Parser options
 * @param _getCurrentOriginalText - Function to get the original source text
 * @param getFormattedCodeBlock - Function to get cached embed-formatted comments
 * @returns The processed comment ready for printing
 */

export type { CodeBlock, ReadonlyCodeBlock };
