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
	getContentTokenString,
	getContentTokenLines,
	createDocCodeBlockToken,
	createDocContentToken,
	removeCommentPrefix,
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
	DocCommentToken,
	DocContentToken,
	DocCodeBlockToken,
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
	isEmbedFormatted: boolean = false,
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
	// Pass isEmbedFormatted flag to preserve formatted code from embed function
	tokens = applyTokenProcessingPipeline(tokens, normalizedComment, isEmbedFormatted);

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
 * @param shouldTrim - Whether to trim the entire string before splitting (preserves indentation if false).
 * @returns Processed code with blank lines preserved.
 */
const processCodeLinesWithBlankLinePreservation = (
	codeToUse: string,
	shouldTrim: boolean = true,
): string => {
	const codeLines = shouldTrim ? codeToUse.trim().split('\n') : codeToUse.split('\n');
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
 * Renders a Doc code block token to text token with formatted lines.
 * @param token - The Doc code block token to render.
 * @param commentPrefix - The comment prefix string.
 * @param options - Options including printWidth.
 * @returns The rendered content token or null if empty.
 */
const renderCodeBlockToken = (
	token: DocCodeBlockToken,
	commentPrefix: string,
	options: Readonly<{
		readonly printWidth?: number;
	}>,
): ContentToken | null => {
	// Code blocks are formatted through Prettier which uses AST-based annotation normalization
	// Use formattedCode if available, otherwise use rawCode
	const codeToUse = token.formattedCode ?? token.rawCode;

	// Preserve blank lines: insert blank line after } when followed by annotations or access modifiers
	// If using formattedCode (already formatted by embed), preserve indentation by not processing
	const processedCode =
		token.formattedCode !== undefined
			? codeToUse // Already formatted, use as-is to preserve indentation
			: processCodeLinesWithBlankLinePreservation(codeToUse, true);
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
 * Renders a Doc text or paragraph token with wrapping applied.
 * @param token - The Doc content token to render.
 * @param commentPrefix - The comment prefix string.
 * @param effectiveWidth - The effective width for wrapping.
 * @param options - Options including tabWidth and useTabs.
 * @returns The rendered content token.
 */
const renderTextOrParagraphToken = (
	token: DocContentToken,
	commentPrefix: string,
	effectiveWidth: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): ContentToken => {
	// Extract string content from Doc for wrapping
	const contentString = getContentTokenString(token);
	const linesString = getContentTokenLines(token);
	const wrappedLines = wrapTextContent(
		contentString,
		linesString,
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
 * Converts ApexDoc Doc comment tokens (including DocAnnotationTokens) back into a
 * normalized comment string.
 * This function is ApexDoc-aware and knows how to render annotation tokens,
 * but defers the final comment construction (including the opening and closing
 * comment markers) to the
 * generic tokensToCommentString helper from comments.ts.
 * @param tokens - Array of Doc-based comment tokens (may include DocAnnotationTokens).
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @param cachedPrefixAndWidth - Optional cached prefix and width calculations.
 * @returns The formatted ApexDoc comment string.
 */
const tokensToApexDocString = (
	tokens: readonly DocCommentToken[],
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

	const apexDocTokens: DocCommentToken[] = [];

	for (const token of tokens) {
		if (token.type === 'annotation') {
			const rendered = renderAnnotationToken(token, commentPrefix);
			if (rendered) {
				// Convert ContentToken to DocContentToken
				apexDocTokens.push(createDocContentToken(
					rendered.type,
					rendered.content,
					rendered.lines,
					rendered.isContinuation,
				));
			}
		} else if (token.type === 'code') {
			const rendered = renderCodeBlockToken(
				token,
				commentPrefix,
				options,
			);
			if (rendered) {
				// Convert ContentToken to DocContentToken
				apexDocTokens.push(createDocContentToken(
					rendered.type,
					rendered.content,
					rendered.lines,
					rendered.isContinuation,
				));
			}
		} else if (token.type === 'text' || token.type === 'paragraph') {
			const rendered = renderTextOrParagraphToken(
				token,
				commentPrefix,
				effectiveWidth,
				options,
			);
			// Convert ContentToken to DocContentToken
			apexDocTokens.push(createDocContentToken(
				rendered.type,
				rendered.content,
				rendered.lines,
				rendered.isContinuation,
			));
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
	readonly tokens: readonly DocCommentToken[];
	readonly effectiveWidth: number;
} => {
	const commentPrefixLength = CommentPrefix.getLength(commentIndent);
	const effectiveWidth = calculateEffectiveWidth(printWidth, commentPrefixLength);

	// Parse comment to tokens using the basic parser (now returns DocCommentToken[])
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
 * Creates a merged DocContentToken from paragraph tokens.
 * @param token - The original Doc content token.
 * @param mergedContent - The merged content string.
 * @param mergedLines - The merged lines array (without comment prefix).
 * @returns The merged Doc content token.
 */
const createMergedDocToken = (
	token: DocContentToken,
	mergedContent: string,
	mergedLines: string[],
): DocContentToken => {
	const { join, hardline } = prettier.doc.builders;
	const docLines = mergedLines.map((line) => line as Doc);
	return {
		type: 'paragraph',
		content:
			docLines.length === 0
				? ('' as Doc)
				: docLines.length === 1
					? docLines[0]
					: join(hardline, docLines),
		lines: docLines,
		...(token.isContinuation !== undefined
			? {
					isContinuation: token.isContinuation,
				}
			: {}),
	};
};

/**
 * Attempts to merge tokens with incomplete code blocks.
 * @param token - The Doc content token to merge.
 * @param codeTagIndex - The index where the code tag starts.
 * @param tokens - Array of all Doc comment tokens.
 * @param startIndex - The starting index in the tokens array.
 * @returns Object with merged token and next index.
 */
const mergeIncompleteCodeBlock = (
	token: DocContentToken,
	codeTagIndex: number,
	tokens: readonly DocCommentToken[],
	startIndex: number,
): { mergedToken: DocContentToken | null; nextIndex: number } => {
	let mergedContent = getContentTokenString(token);
	let mergedLines = getContentTokenLines(token);
	let hasCompleteBlock = hasCompleteCodeBlock(mergedContent, codeTagIndex);
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- index increment
	let j = startIndex + INDEX_ONE;

	while (j < tokens.length && !hasCompleteBlock) {
		const nextToken = tokens[j];
		if (!nextToken) {
			j++;
			continue;
		}
		if (nextToken.type !== 'paragraph' && nextToken.type !== 'text') {
			// Non-content token, stop merging
			break;
		}

		const nextContent = getContentTokenString(nextToken);
		mergedContent += nextContent;
		mergedLines = [...mergedLines, ...getContentTokenLines(nextToken)];

		// Check if the merged content now has a complete block
		hasCompleteBlock = hasCompleteCodeBlock(mergedContent, codeTagIndex);

		if (hasCompleteBlock) {
			// Found complete block, create merged token
			const mergedToken = createMergedDocToken(
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
 * @param tokens - Array of Doc-based comment tokens.
 * @returns Array of tokens with merged {@code} blocks.
 */
const mergeCodeBlockTokens = (
	tokens: readonly DocCommentToken[],
): readonly DocCommentToken[] => {
	const mergedTokens: DocCommentToken[] = [];
	let i = 0;

	while (i < tokens.length) {
		const token = tokens[i];
		if (!token) {
			i++;
			continue;
		}

		if (token.type !== 'paragraph' && token.type !== 'text') {
			// Non-content token, add as-is
			mergedTokens.push(token);
			i++;
			continue;
		}

		// Extract string content from Doc for text operations
		const content = getContentTokenString(token);
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
		// Type guard: ensure token is DocContentToken
		if (token.type === 'paragraph' || token.type === 'text') {
			const mergeResult = mergeIncompleteCodeBlock(
				token,
				codeTagIndex,
				tokens,
				i,
			);
			if (mergeResult.mergedToken) {
				mergedTokens.push(mergeResult.mergedToken);
				i = mergeResult.nextIndex + 1;
			} else {
				// Couldn't find complete block, add original token
				mergedTokens.push(token);
				i++;
			}
		} else {
			// Non-content token, shouldn't happen but handle gracefully
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
 * @param tokens - Array of Doc-based comment tokens.
 * @param normalizedComment - The normalized comment text (may be undefined in async contexts).
 * @param isEmbedFormatted - Whether the comment was already formatted by the embed function.
 * @returns Array of processed Doc tokens.
 */
const applyTokenProcessingPipeline = (
	tokens: readonly DocCommentToken[],
	normalizedComment?: string,
	isEmbedFormatted: boolean = false,
): readonly DocCommentToken[] => {
	// Detect code blocks first to separate {@code} content from regular text
	// Pass isEmbedFormatted flag to preserve formatted code
	let processedTokens = detectCodeBlockTokens(
		tokens,
		normalizedComment !== undefined ? normalizedComment : '',
		isEmbedFormatted,
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
 * Creates a Doc text token from cleaned text for paragraph tokens.
 * @param cleanedText - The cleaned text content.
 * @param token - The Doc content token.
 * @returns The created Doc text token or null if empty.
 */
const createDocTextTokenFromParagraph = (
	cleanedText: string,
	token: DocContentToken,
): DocContentToken | null => {
	const splitLines = cleanedText
		.split('\n')
		.filter((line: string) => line.trim().length > EMPTY);
	if (splitLines.length === EMPTY) {
		return null;
	}
	return createDocContentToken('text', cleanedText, splitLines);
};

/**
 * Creates a Doc text token from cleaned text for text tokens.
 * @param cleanedText - The cleaned text content.
 * @returns The created Doc text token or null if empty.
 */
const createDocTextTokenFromText = (
	cleanedText: string,
): DocContentToken | null => {
	const splitLines = cleanedText.split('\n');
	const cleanedLines = removeTrailingEmptyLines(splitLines);
	if (cleanedLines.length === EMPTY) {
		return null;
	}
	return createDocContentToken('text', cleanedText, cleanedLines);
};

/**
 * Processes remaining text after last code tag.
 * @param content - The content string.
 * @param currentPos - The current position in content.
 * @param token - The Doc content token.
 * @param newTokens - Array to add new Doc tokens to.
 */
const processRemainingText = (
	content: string,
	currentPos: number,
	token: DocContentToken,
	newTokens: DocCommentToken[],
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
			? createDocTextTokenFromParagraph(cleanedText, token)
			: createDocTextTokenFromText(cleanedText);
	if (textToken) {
		newTokens.push(textToken);
	}
};

/**
 * Processes text before code tag.
 * @param content - The content string.
 * @param lastMatchEnd - The end position of last match.
 * @param codeTagStart - The start position of code tag.
 * @param token - The Doc content token.
 * @param newTokens - Array to add new Doc tokens to.
 */
const processTextBeforeCode = (
	content: string,
	lastMatchEnd: number,
	codeTagStart: number,
	token: DocContentToken,
	newTokens: DocCommentToken[],
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
			? createDocTextTokenFromParagraph(cleanedText, token)
			: createDocTextTokenFromText(cleanedText);
	if (textToken) {
		newTokens.push(textToken);
	}
};

/**
 * Processes Doc content token to detect code blocks.
 * @param token - The Doc content token to process.
 * @param newTokens - Array to add new Doc tokens to.
 * @param isEmbedFormatted - Whether the comment was already formatted by the embed function.
 */
const processContentTokenForCodeBlocks = (
	token: DocContentToken,
	newTokens: DocCommentToken[],
	isEmbedFormatted: boolean = false,
): void => {
	// Extract string content from Doc for text operations
	const content = getContentTokenString(token);
	const lines = getContentTokenLines(token);
	// For content tokens, work with the lines array to preserve line breaks
	// Use removeCommentPrefix with preserveIndent=true to preserve code block indentation
	const processedContent =
		token.type === 'paragraph'
			? lines
					.map((line: string) => removeCommentPrefix(line, true))
					.join('\n')
			: lines.join('\n');
	let currentPos = ARRAY_START_INDEX;
	let lastMatchEnd = ARRAY_START_INDEX;

	while (currentPos < processedContent.length) {
		const codeTagStart = processedContent.indexOf(CODE_TAG, currentPos);

		if (codeTagStart === NOT_FOUND_INDEX) {
			processRemainingText(processedContent, currentPos, token, newTokens);
			break;
		}

		processTextBeforeCode(
			processedContent,
			lastMatchEnd,
			codeTagStart,
			token,
			newTokens,
		);

		const codeBlockResult = extractCodeFromBlock(processedContent, codeTagStart);
		if (codeBlockResult) {
			// If comment was already formatted by embed function, treat extracted code as formatted
			const formattedCode = isEmbedFormatted ? codeBlockResult.code : undefined;
			newTokens.push(
				createDocCodeBlockToken(
					codeTagStart,
					codeBlockResult.endPos,
					codeBlockResult.code,
					formattedCode,
				),
			);
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
 * Converts DocContentToken content containing {@code} to DocCodeBlockToken.
 * @param tokens - Array of Doc-based comment tokens.
 * @param _originalComment - The original comment string for position tracking (unused but kept for API compatibility).
 * @param isEmbedFormatted - Whether the comment was already formatted by the embed function.
 * @returns Array of tokens with code blocks detected.
 */
const detectCodeBlockTokens = (
	tokens: readonly DocCommentToken[],
	_originalComment: Readonly<string>,
	isEmbedFormatted: boolean = false,
): readonly DocCommentToken[] => {
	const newTokens: DocCommentToken[] = [];

	for (const token of tokens) {
		if (token.type === 'text' || token.type === 'paragraph') {
			processContentTokenForCodeBlocks(token, newTokens, isEmbedFormatted);
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
