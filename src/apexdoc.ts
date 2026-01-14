/**
 * @file Unified token-based processing system for ApexDoc comments.
 *
 * This module provides a consolidated approach to handling ApexDoc comments through:
 * - Token parsing and processing (async-first)
 * - Code block detection and formatting
 * - Annotation normalization and wrapping
 * - Integration with Prettier's document building system
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
	ARRAY_START_INDEX,
	INDEX_ONE,
	INDEX_TWO,
	STRING_OFFSET,
	EMPTY,
	NOT_FOUND_INDEX,
} from './comments.js';
import type {
	CommentToken,
	ContentToken,
	AnnotationToken,
	CodeBlockToken,
} from './comments.js';
import {
	APEXDOC_ANNOTATIONS,
	APEXDOC_GROUP_NAMES,
} from './refs/apexdoc-annotations.js';

// Use Set for O(1) lookup instead of array.includes() O(n)
const APEXDOC_ANNOTATIONS_SET = new Set(APEXDOC_ANNOTATIONS);
import {
	extractCodeFromBlock,
	EMPTY_CODE_TAG,
	CODE_TAG,
} from './apexdoc-code.js';
import { startsWithAccessModifier } from './utils.js';
import { removeCommentPrefix } from './comments.js';
import {
	normalizeAnnotationNamesInText,
	normalizeAnnotationNamesInTextExcludingApexDoc,
} from './annotations.js';

const COMMENT_START_MARKER = '/**';
const COMMENT_END_MARKER = '*/';
const COMMENT_START_LENGTH = COMMENT_START_MARKER.length;
const ZERO_INDENT = 0;
const BODY_INDENT_WHEN_ZERO = 2;
const COMMENT_END_LENGTH = COMMENT_END_MARKER.length;

/**
 * Calculates comment prefix and effective width for ApexDoc formatting.
 * Caches these calculations to avoid repeated computation.
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
	const effectiveWidth =
		(printWidth ?? 80) - actualPrefixLength;
	return {
		commentPrefix,
		bodyIndent,
		actualPrefixLength,
		effectiveWidth,
	};
};

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
	// eslint-disable-next-line @typescript-eslint/no-use-before-define
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
	// eslint-disable-next-line @typescript-eslint/no-use-before-define
	let tokens = mergeCodeBlockTokens(initialTokens);

	// Apply common token processing pipeline
	// eslint-disable-next-line @typescript-eslint/no-use-before-define
	tokens = applyTokenProcessingPipeline(tokens, normalizedComment);

	// Wrap annotations if printWidth is available
	// Calculate effectiveWidth accounting for body indentation (same as tokensToApexDocString)
	if (printWidth) {
		const { effectiveWidth, actualPrefixLength } = calculatePrefixAndWidth(
			commentIndent,
			printWidth,
			{
				tabWidth: tabWidthValue,
				useTabs: options.useTabs,
			},
		);

		// Pass the actual prefix length to wrapAnnotationTokens so it can calculate first line width correctly
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		tokens = wrapAnnotationTokens(
			tokens,
			effectiveWidth,
			commentIndent,
			actualPrefixLength,
			{
				tabWidth: tabWidthValue,
				useTabs: options.useTabs,
			},
		);
	}

	// Convert tokens back to string
	// For now, skip paragraph wrapping to avoid filtering out text tokens
	// TODO: Implement proper paragraph wrapping that preserves all token types
	const finalTokens = tokens;

	// eslint-disable-next-line @typescript-eslint/no-use-before-define
	const commentString = tokensToApexDocString(finalTokens, commentIndent, {
		printWidth: printWidth,
		tabWidth: tabWidthValue,
		useTabs: options.useTabs,
	});

	// Convert the formatted comment string to Doc
	const lines = commentString.split('\n');
	const { join, hardline } = prettier.doc.builders;
	return join(hardline, lines);
};

/**
 * Renders an annotation token to text token with formatted lines.
 */
const renderAnnotationToken = (
	token: AnnotationToken,
	commentPrefix: string,
): ContentToken | null => {
	const contentLines =
		token.content.length > EMPTY ? token.content.split('\n') : [''];
	const lines: string[] = [];
	const annotationName = token.name;

	// Add followingText before annotation if it exists
	if (
		token.followingText &&
		token.followingText.trim().length > EMPTY
	) {
		const followingLines = token.followingText
			.split('\n')
			.filter((line: string) => line.trim().length > EMPTY);
		for (const line of followingLines) {
			lines.push(`${commentPrefix}${line.trim()}`);
		}
	}

	// First line includes the @annotation name
	const firstContent = contentLines[ARRAY_START_INDEX] ?? '';
	const firstLine =
		firstContent.length > EMPTY
			? `${commentPrefix}@${annotationName} ${firstContent}`
			: `${commentPrefix}@${annotationName}`;
	lines.push(firstLine);

	// Subsequent lines are continuation of the annotation content
	for (let i = INDEX_ONE; i < contentLines.length; i++) {
		const lineContent = contentLines[i] ?? '';
		if (lineContent.length > EMPTY) {
			lines.push(`${commentPrefix}${lineContent}`);
		} else {
			lines.push(commentPrefix.trimEnd());
		}
	}

	const cleanedLines = removeTrailingEmptyLines(lines);
	return cleanedLines.length > EMPTY
		? {
				content: cleanedLines.join('\n'),
				lines: cleanedLines,
				type: 'text',
			}
		: null;
};

/**
 * Renders a code block token to text token with formatted lines.
 */
const renderCodeBlockToken = (
	token: CodeBlockToken,
	commentPrefix: string,
	options: Readonly<{
		readonly printWidth?: number;
	}>,
): ContentToken | null => {
	let codeToUse = token.formattedCode ?? token.rawCode;
	if (!token.formattedCode) {
		codeToUse = normalizeAnnotationNamesInText(codeToUse);
	}

	// Preserve blank lines: insert blank line after } when followed by annotations or access modifiers
	const codeLines = codeToUse.trim().split('\n');
	const resultLines: string[] = [];

	for (let i = 0; i < codeLines.length; i++) {
		const codeLine = codeLines[i] ?? '';
		const trimmedLine = codeLine.trim();
		resultLines.push(codeLine);

		if (trimmedLine.endsWith('}') && i < codeLines.length - 1) {
			const nextLine = codeLines[i + 1]?.trim() ?? '';
			if (
				nextLine.length > 0 &&
				(nextLine.startsWith('@') ||
					startsWithAccessModifier(nextLine))
			) {
				resultLines.push('');
			}
		}
	}

	codeToUse = resultLines.join('\n');
	const isEmptyBlock = codeToUse.trim().length === EMPTY;
	const lines: string[] = [];

	if (isEmptyBlock) {
		lines.push(`${commentPrefix}{@code}`);
	} else if (codeToUse.length > EMPTY) {
		const codeLines = codeToUse.split('\n');
		const alreadyWrapped = codeToUse.trim().startsWith('{@code');
		let finalCodeLines: string[];

		if (alreadyWrapped) {
			finalCodeLines = codeLines;
			if (finalCodeLines.length === 1) {
				const line = finalCodeLines[0];
				if (line && line.includes(';') && line.endsWith('}')) {
					finalCodeLines[0] = line.slice(0, -1) + ' }';
				}
			}
		} else {
			const isSingleLine = codeLines.length === 1;
			const singleLineContent = codeLines[0]?.trim() ?? '';
			const singleLineWithBraces = `{@code ${singleLineContent} }`;
			const printWidth = options.printWidth ?? 80;
			const fitsOnOneLine =
				singleLineWithBraces.length <= printWidth - commentPrefix.length;

			finalCodeLines =
				isSingleLine && fitsOnOneLine
					? [singleLineWithBraces]
					: [`{@code`, ...codeLines, `}`];
		}

		for (const codeLine of finalCodeLines) {
			lines.push(
				codeLine.trim().length === EMPTY
					? commentPrefix.trimEnd()
					: `${commentPrefix}${codeLine}`,
			);
		}
	}

	return lines.length > EMPTY
		? {
				type: 'text',
				content: lines.join('\n'),
				lines,
			}
		: null;
};

/**
 * Renders a text or paragraph token with wrapping applied.
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
	const linesWithPrefix = cleanedLines.map(
		(line: string) => `${commentPrefix}${line.trim()}`,
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
): string => {
	const { commentPrefix, effectiveWidth } = calculatePrefixAndWidth(
		commentIndent,
		options.printWidth,
		options,
	);

	const apexDocTokens: CommentToken[] = [];

	for (const token of tokens) {
		if (token.type === 'annotation') {
			const rendered = renderAnnotationToken(token, commentPrefix);
			if (rendered) apexDocTokens.push(rendered);
		} else if (token.type === 'code') {
			const rendered = renderCodeBlockToken(token, commentPrefix, options);
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
		.filter((line) => line.length > EMPTY);

	const joinedParts: string[] = [];
	for (let i = 0; i < cleanedLines.length; i++) {
		const currentLine = cleanedLines[i]?.trim() ?? '';
		const nextLine = cleanedLines[i + 1]?.trim() ?? '';

		// Check if we should join with next line
		const currentEndsWithPeriod = currentLine.endsWith('.');
		const nextStartsWithCapital = nextLine && /^[A-Z]/.test(nextLine);
		const shouldJoin =
			!currentEndsWithPeriod &&
			!nextStartsWithCapital &&
			nextLine.length > 0;

		if (shouldJoin && i < cleanedLines.length - 1) {
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
	const effectiveWidth = printWidth - commentPrefixLength;

	// Parse comment to tokens using the basic parser
	let tokens = parseCommentToTokens(normalizedComment);

	return {
		tokens,
		effectiveWidth,
	};
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

		if (token.type === 'paragraph') {
			const content = token.content;
			const codeTagIndex = content.indexOf('{@code');

			if (codeTagIndex !== -1) {
				// Check if this token contains a complete {@code} block
				let braceCount = 0;
				let hasCompleteBlock = false;
				let searchPos = codeTagIndex;

				while (searchPos < content.length && !hasCompleteBlock) {
					if (content[searchPos] === '{') {
						braceCount++;
					} else if (content[searchPos] === '}') {
						braceCount--;
						if (braceCount === 0) {
							hasCompleteBlock = true;
						}
					}
					searchPos++;
				}

				if (!hasCompleteBlock) {
					// Need to merge with subsequent tokens
					let mergedContent = content;
					let mergedLines = [...token.lines];
					let j = i + 1;

					while (j < tokens.length && !hasCompleteBlock) {
						const nextToken = tokens[j];
						if (!nextToken) {
							j++;
							continue;
						}
						if (nextToken.type === 'paragraph') {
							const nextContent = nextToken.content;
							mergedContent += nextContent;
							mergedLines.push(...nextToken.lines);

							// Check if the merged content now has a complete block
							braceCount = 0;
							searchPos = codeTagIndex;
							hasCompleteBlock = false;

							while (
								searchPos < mergedContent.length &&
								!hasCompleteBlock
							) {
								if (mergedContent[searchPos] === '{') {
									braceCount++;
								} else if (mergedContent[searchPos] === '}') {
									braceCount--;
									if (braceCount === 0) {
										hasCompleteBlock = true;
									}
								}
								searchPos++;
							}

							if (hasCompleteBlock) {
								// Found complete block, create merged token
								const mergedToken: ContentToken = {
									type: 'paragraph',
									content: mergedContent,
									lines: mergedLines,
									...(token.isContinuation !== undefined
										? { isContinuation: token.isContinuation }
										: {}),
								};
								mergedTokens.push(mergedToken);
								i = j; // Skip the merged tokens
							}
						} else {
							// Non-paragraph token, stop merging
							break;
						}
						j++;
					}

					if (!hasCompleteBlock) {
						// Couldn't find complete block, add original token
						mergedTokens.push(token);
					}
				} else {
					// Complete block in single token
					mergedTokens.push(token);
				}
			} else {
				// No {@code} tag, add as-is
				mergedTokens.push(token);
			}
		} else {
			// Non-paragraph token, add as-is
			mergedTokens.push(token);
		}

		i++;
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
	let processedTokens = detectCodeBlockTokens(tokens, normalizedComment ?? '');

	// Detect annotations in tokens that contain ApexDoc content
	// Code blocks are now handled as separate tokens
	processedTokens = detectAnnotationsInTokens(
		processedTokens,
		normalizedComment ?? '',
	);

	// Normalize annotations
	processedTokens = normalizeAnnotationTokens(processedTokens);

	return processedTokens;
};

/**
 * Extracts text before an annotation, filtering out annotation patterns.
 * @param line - The line containing the annotation.
 * @param matchIndex - The index where the annotation starts.
 * @returns The cleaned beforeText, or empty string if it contains annotations.
 */
const extractBeforeText = (line: string, matchIndex: number): string => {
	const beforeAnnotation = line.substring(ARRAY_START_INDEX, matchIndex);
	let beforeText = beforeAnnotation.replace(/^\s*\*\s*/, '').trim();
	// Filter out annotation patterns from beforeText to prevent duplication
	if (
		beforeText.length > EMPTY &&
		/@[a-zA-Z_][a-zA-Z0-9_]*/.test(beforeText)
	) {
		return '';
	}
	return beforeText;
};

/**
 * Collects continuation lines for an annotation from normalizedComment.
 * @param annotationName - The annotation name.
 * @param content - The initial annotation content.
 * @param line - The current line text.
 * @param normalizedComment - The normalized comment text.
 * @param consumedContent - Set to track consumed content.
 * @returns The full annotation content with continuation lines.
 */
const collectContinuationFromComment = (
	annotationName: string,
	content: string,
	_line: string,
	normalizedComment: string,
	consumedContent: Set<string>,
): string => {
	const escapedAnnotationName = annotationName.replace(
		/[.*+?^${}()|[\]\\]/g,
		'\\$&',
	);
	const escapedContent = content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const specificAnnotationRegex = new RegExp(
		`@${escapedAnnotationName}\\s+${escapedContent}([^@{]*?)(?=\\n\\s*\\*\\s*@|\\*/|\\{@code|$)`,
		's',
	);
	const continuationMatch = normalizedComment.match(specificAnnotationRegex);
	if (!continuationMatch || !continuationMatch[INDEX_ONE]) return content;

	let continuationContent = continuationMatch[INDEX_ONE];
	continuationContent = continuationContent.replace(/\s*\*\s*$/, '').trim();
	if (continuationContent.includes('{')) {
		continuationContent = continuationContent
			.substring(0, continuationContent.indexOf('{'))
			.trim();
	}
	const continuationLines = continuationContent
		.split('\n')
		.map((line) => removeCommentPrefix(line))
		.filter(
			(l) =>
				l.length > EMPTY &&
				!l.startsWith('@') &&
				!l.startsWith('{@code'),
		);
	if (continuationLines.length > 0) {
		for (const continuationLine of continuationLines) {
			consumedContent.add(continuationLine.trim());
		}
		return `${content} ${continuationLines.join(' ')}`;
	}
	return content;
};

/**
 * Collects continuation lines for an annotation from tokenLines.
 * @param content - The initial annotation content.
 * @param tokenLines - The token lines array.
 * @param startIndex - The index to start looking from.
 * @returns Object with annotationContent and the next line index.
 */
const collectContinuationFromTokenLines = (
	content: string,
	tokenLines: readonly string[],
	startIndex: number,
): { annotationContent: string; nextIndex: number } => {
	let annotationContent = content;
	let continuationIndex = startIndex;
	while (continuationIndex < tokenLines.length) {
		const continuationLine = tokenLines[continuationIndex] ?? '';
		const trimmedLine = continuationLine.replace(/^\s*\*\s*/, '').trim();
		if (
			trimmedLine.length === EMPTY ||
			trimmedLine.startsWith('@') ||
			trimmedLine.startsWith('{@code')
		) {
			break;
		}
		annotationContent += ' ' + trimmedLine;
		continuationIndex++;
	}
	return { annotationContent, nextIndex: continuationIndex - 1 };
};

/**
 * Detects annotations in tokens and converts TextTokens/ParagraphTokens to AnnotationTokens.
 * Scans tokens for @param, @return, etc. patterns.
 * @param tokens - Array of comment tokens.
 * @returns Array of tokens with annotations detected.
 */
const detectAnnotationsInTokens = (
	tokens: readonly CommentToken[],
	normalizedComment?: string,
): readonly CommentToken[] => {
	const newTokens: CommentToken[] = [];
	// Track content that has been extracted as annotation continuation to avoid duplicating it as text tokens
	const consumedContent = new Set<string>();
	// Detect annotations using regex (annotation parsing in comment text is inherently text-based)

	for (const token of tokens) {
		if (isContentToken(token)) {
			// For paragraph tokens, use content (which has all lines joined) and split by original line structure
			// For text tokens, use lines array directly
			const tokenLines =
				token.type === 'paragraph' && token.content.includes('\n')
					? token.content.split('\n')
					: token.lines;
			let processedLines: string[] = [];
			let hasAnnotations = false;

			for (
				let lineIndex = 0;
				lineIndex < tokenLines.length;
				lineIndex++
			) {
				const line = tokenLines[lineIndex] ?? '';
				// Annotation pattern: @ followed by identifier, possibly with content
				// After detectCodeBlockTokens, lines have their " * " prefix stripped, so we need to match lines with or without prefix
				// Pattern matches: (optional prefix) @ (name) (content)
				const annotationPattern =
					/(?:^\s*\*\s*|\s+(?!\{)|\s*\*\s*\.\s*\*\s*|^|\s+)@([a-zA-Z_][a-zA-Z0-9_]*)(\s*[^\n@]*?)(?=\s*@|\s*\*|\s*$)/g;

				const matches = [...line.matchAll(annotationPattern)];
				if (matches.length > EMPTY) {
					hasAnnotations = true;
					// Process each annotation match
					for (const match of matches) {
						const annotationName = match[INDEX_ONE] ?? '';
						const content = (match[INDEX_TWO] ?? '').trim();
						const lowerName = annotationName.toLowerCase();
						const beforeText = extractBeforeText(
							line,
							match.index ?? ARRAY_START_INDEX,
						);

						// Collect continuation lines for this annotation
						let annotationContent = content;
						if (tokenLines.length === 1 && normalizedComment) {
							annotationContent = collectContinuationFromComment(
								annotationName,
								content,
								line,
								normalizedComment,
								consumedContent,
							);
						} else {
							const continuation =
								collectContinuationFromTokenLines(
									content,
									tokenLines,
									lineIndex + 1,
								);
							annotationContent = continuation.annotationContent;
							lineIndex = continuation.nextIndex;
						}

						newTokens.push({
							type: 'annotation',
							name: lowerName,
							content: annotationContent,
							...(beforeText.length > EMPTY
								? { followingText: beforeText }
								: {}),
						} satisfies AnnotationToken);
					}
				} else {
					processedLines.push(line);
				}
			}

			if (!hasAnnotations) {
				// Check if this token's content was consumed as annotation continuation
				// Check if all non-empty lines (that aren't annotations or code blocks) were consumed
				const tokenLinesToCheck = token.content
					.split('\n')
					.map((line) => removeCommentPrefix(line))
					.filter(
						(l) =>
							l.length > EMPTY &&
							!l.startsWith('@') &&
							!l.startsWith('{@code'),
					);
				// Skip if all lines were consumed - use simple loop instead of .every()
				if (tokenLinesToCheck.length > 0) {
					let allConsumed = true;
					for (const line of tokenLinesToCheck) {
						if (!consumedContent.has(line)) {
							allConsumed = false;
							break;
						}
					}
					if (allConsumed) continue;
				}
				newTokens.push(token);
			} else if (processedLines.length > EMPTY) {
				const remainingContent = processedLines
					.map((l) => l.replace(/^\s*\*\s*/, '').trim())
					.filter((l) => l.length > EMPTY && !consumedContent.has(l))
					.join(' ');
				if (remainingContent.length > EMPTY) {
					newTokens.push({
						type: 'text',
						content: remainingContent,
						lines: processedLines,
					} satisfies ContentToken);
				}
			}
		} else {
			newTokens.push(token);
		}
	}
	return newTokens;
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
			// For content tokens, work with the lines array to preserve line breaks
			// Off-by-one fix: only remove " *" or " * " (asterisk + optional single space), preserve extra indentation spaces
			// Match /^\s*\*\s?/ to remove asterisk and at most one space, preserving code block indentation
			const content =
				token.type === 'paragraph'
					? token.lines
							.map((line: string) =>
								line.replace(/^\s*\*\s?/, ''),
							)
							.join('\n')
					: token.lines.join('\n');
			let currentPos = ARRAY_START_INDEX;
			let lastMatchEnd = ARRAY_START_INDEX;

			while (currentPos < content.length) {
				const codeTagStart = content.indexOf(CODE_TAG, currentPos);

				if (codeTagStart === NOT_FOUND_INDEX) {
					if (currentPos < content.length) {
						const remainingText = content.substring(currentPos);
						if (remainingText.length > EMPTY) {
							// Remove trailing newlines before splitting
							const cleanedText = remainingText.trimEnd();
							if (cleanedText.length > EMPTY) {
								// For paragraph tokens, content has prefixes stripped, so extract prefix from original lines
								// For text tokens, content now preserves prefixes from token.lines
								if (token.type === 'paragraph') {
									// Extract prefix from original lines
									const firstLineWithPrefix =
										token.lines.find((line: string) => {
											const trimmed = line.trimStart();
											return (
												trimmed.length > 0 &&
												trimmed.startsWith('*')
											);
										});
									let prefix = ' * '; // Default fallback
									if (firstLineWithPrefix) {
										const prefixMatch =
											firstLineWithPrefix.match(
												/^(\s*\*\s*)/,
											);
										if (prefixMatch?.[1]) {
											prefix = prefixMatch[1];
										}
									}
									const splitLines = cleanedText
										.split('\n')
										.filter(
											(line: string) =>
												line.trim().length > 0,
										);
									if (splitLines.length > 0) {
										newTokens.push({
											type: 'text',
											content: cleanedText,
											lines: splitLines.map(
												(line: string) =>
													`${prefix}${line.trim()}`,
											),
										} satisfies ContentToken);
									}
								} else {
									// For text tokens, content now preserves prefixes from token.lines
									const splitLines = cleanedText.split('\n');
									const cleanedLines =
										removeTrailingEmptyLines(splitLines);
									if (cleanedLines.length > 0) {
										newTokens.push({
											type: 'text',
											content: cleanedText,
											lines: cleanedLines,
										} satisfies ContentToken);
									}
								}
							}
						}
					}
					break;
				}

				if (codeTagStart > lastMatchEnd) {
					const textBeforeCode = content.substring(
						lastMatchEnd,
						codeTagStart,
					);
					if (textBeforeCode.length > EMPTY) {
						// Remove trailing newlines from textBeforeCode before splitting to avoid empty trailing lines
						const cleanedText = textBeforeCode.trimEnd();
						if (cleanedText.length > EMPTY) {
							// For paragraph tokens, content has prefixes stripped, so we need to extract prefix from original lines
							// For text tokens, content now comes from token.lines which preserves prefixes
							if (token.type === 'paragraph') {
								// Extract prefix pattern from first non-empty line in token.lines that has a prefix
								// The prefix should include base indent (spaces) + ' * '
								const firstLineWithPrefix = token.lines.find(
									(line: string) => {
										const trimmed = line.trimStart();
										return (
											trimmed.length > 0 &&
											trimmed.startsWith('*')
										);
									},
								);
								let prefix = ' * '; // Default fallback
								if (firstLineWithPrefix) {
									// Match from start: any whitespace + asterisk + optional space
									const prefixMatch =
										firstLineWithPrefix.match(
											/^(\s*\*\s*)/,
										);
									if (prefixMatch?.[1]) {
										prefix = prefixMatch[1];
									}
								}

								const lines = cleanedText
									.split('\n')
									.filter(
										(line: string) =>
											line.trim().length > 0,
									);
								if (lines.length > 0) {
									const linesWithPrefix = lines.map(
										(line: string) =>
											`${prefix}${line.trim()}`,
									);
									newTokens.push({
										type: 'text',
										content: cleanedText,
										lines: linesWithPrefix,
									} satisfies ContentToken);
								}
							} else {
								// For text tokens, content now preserves prefixes from token.lines
								// Split and filter out empty trailing lines while preserving prefixes
								const splitLines = cleanedText.split('\n');
								const cleanedLines =
									removeTrailingEmptyLines(splitLines);
								if (cleanedLines.length > 0) {
									newTokens.push({
										type: 'text',
										content: cleanedText,
										lines: cleanedLines,
									} satisfies ContentToken);
								}
							}
						}
					}
				}

				const codeBlockResult = extractCodeFromBlock(
					content,
					codeTagStart,
				);
				if (codeBlockResult) {
					newTokens.push({
						type: 'code',
						startPos: codeTagStart,
						endPos: codeBlockResult.endPos,
						rawCode: codeBlockResult.code,
					} satisfies CodeBlockToken);
					currentPos = codeBlockResult.endPos;
					lastMatchEnd = codeBlockResult.endPos;
				} else {
					currentPos = codeTagStart + CODE_TAG.length;
					lastMatchEnd = currentPos;
				}
			}
		} else {
			newTokens.push(token);
		}
	}
	return newTokens;
};

/**
 * Normalizes annotation names in tokens (e.g., @Param -> @param).
 * Processes AnnotationToken, TextToken, and ParagraphToken types.
 * Skips normalization within {@code} blocks.
 * @param tokens - Array of comment tokens.
 * @returns Array of tokens with normalized annotation names.
 */
const normalizeAnnotationTokens = (
	tokens: readonly CommentToken[],
): readonly CommentToken[] => {
	return tokens.map((token) => {
		if (token.type === 'annotation') {
			const lowerName = token.name.toLowerCase();
			// Use Set lookup instead of array.includes() for better performance
			if (APEXDOC_ANNOTATIONS_SET.has(lowerName)) {
				let normalizedContent = token.content;
				// Special handling for @group annotations - normalize the group name
				if (lowerName === 'group' && token.content) {
					// Extract the first word (group name) and any remaining content (description)
					const contentTrimmed = token.content.trim();
					const firstSpaceIndex = contentTrimmed.indexOf(' ');
					const groupName =
						firstSpaceIndex > 0
							? contentTrimmed.substring(0, firstSpaceIndex)
							: contentTrimmed;
					const description =
						firstSpaceIndex > 0
							? contentTrimmed.substring(firstSpaceIndex + 1)
							: '';

					// Normalize only the group name (first word)
					const lowerGroupName = groupName.toLowerCase();
					const mappedValue =
						APEXDOC_GROUP_NAMES[
							lowerGroupName as keyof typeof APEXDOC_GROUP_NAMES
						];

					// Reconstruct content with normalized group name and original description
					if (mappedValue) {
						normalizedContent =
							description.length > 0
								? `${mappedValue} ${description}`
								: mappedValue;
					} else {
						// Group name not in mapping, keep original
						normalizedContent = token.content;
					}
				}
				return {
					...token,
					name: lowerName,
					content: normalizedContent,
				} satisfies AnnotationToken;
			}
		} else if (isContentToken(token)) {
			// Content tokens should NOT contain ApexDoc annotations as text after detectAnnotationsInTokens
			// ApexDoc annotations should have been converted to annotation tokens by detectAnnotationsInTokens
			// If any annotations remain as text, they're either:
			// 1. Apex code annotations (should be normalized to PascalCase)
			// 2. ApexDoc annotations that weren't detected (should remain unchanged, but this shouldn't happen)
			// Since detectAnnotationsInTokens runs before this, we should NOT normalize ApexDoc annotations here
			// They should already be converted to annotation tokens and handled separately
			// Normalize annotations in text/paragraph tokens, but skip {@code} blocks
			const content = token.content;

			// Check if content contains {@code} blocks using token structure instead of string search
			// Look for code block tokens in the token array rather than searching content string
			// For now, use simple string check but prefer token-based detection when available
			const hasCodeBlock = content.includes('{@code');
			if (hasCodeBlock) {
				// Split content by {@code} blocks and normalize each segment
				const parts: string[] = [];
				let lastIndex = 0;
				let startIndex = 0;

				// Use string.indexOf instead of regex for better performance
				while (
					(startIndex = content.indexOf('{@code', lastIndex)) !== -1
				) {
					// Normalize text before {@code} block - exclude ApexDoc annotations
					const beforeCode = content.substring(lastIndex, startIndex);
					if (beforeCode.length > EMPTY) {
						parts.push(
							normalizeAnnotationNamesInTextExcludingApexDoc(
								beforeCode,
							),
						);
					}

					// Find the end of {@code} block
					const codeTagLength = '{@code'.length;
					let endIndex = content.indexOf(
						'}',
						startIndex + codeTagLength,
					);
					if (endIndex === -1) {
						// Malformed {@code} block, include rest as-is
						parts.push(content.substring(startIndex));
						lastIndex = content.length;
						break;
					}

					// Include {@code} block unchanged (skip normalization)
					parts.push(content.substring(startIndex, endIndex + 1));
					lastIndex = endIndex + 1;
				}

				// Normalize remaining text after last {@code} block - exclude ApexDoc annotations
				if (lastIndex < content.length) {
					const afterCode = content.substring(lastIndex);
					if (afterCode.length > EMPTY) {
						parts.push(
							normalizeAnnotationNamesInTextExcludingApexDoc(
								afterCode,
							),
						);
					}
				}

				const normalizedContent = parts.join('');

				// Update lines if content changed
				if (normalizedContent !== content) {
					const normalizedLines = normalizedContent.split('\n');
					if (token.type === 'text' || token.type === 'paragraph') {
						return {
							...token,
							content: normalizedContent,
							lines: normalizedLines,
						} satisfies ContentToken;
					}
				}
			} else {
				// No {@code} blocks - preserve ApexDoc annotations unchanged
				// Only normalize non-ApexDoc annotations (Apex code annotations)
				const normalizedContent =
					normalizeAnnotationNamesInTextExcludingApexDoc(content);
				if (normalizedContent !== content) {
					const normalizedLines = normalizedContent.split('\n');
					if (token.type === 'text' || token.type === 'paragraph') {
						return {
							...token,
							content: normalizedContent,
							lines: normalizedLines,
						} satisfies ContentToken;
					}
				}
			}
		}
		return token;
	});
};

/**
 * Wraps annotation tokens based on effective page width.
 * @param tokens - Array of comment tokens.
 * @param effectiveWidth - The effective page width (printWidth - comment prefix length).
 * @param _commentIndent - The indentation level of the comment (unused but kept for API compatibility).
 * @param options - Options including tabWidth and useTabs.
 * @returns Array of tokens with wrapped annotations.
 */
const wrapAnnotationTokens = (
	tokens: readonly CommentToken[],
	effectiveWidth: number,
	_commentIndent: number,
	actualPrefixLength: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): readonly CommentToken[] => {
	const newTokens: CommentToken[] = [];
	const printWidth = effectiveWidth + actualPrefixLength;

	for (const token of tokens) {
		if (token.type === 'annotation') {
			const annotationContent = token.content;
			const annotationPrefixLength = `@${token.name} `.length;
			// First line includes @annotation name after comment prefix
			// First line prefix = actualPrefixLength + annotationPrefixLength
			// First line available = printWidth - firstLinePrefix
			const firstLinePrefix = actualPrefixLength + annotationPrefixLength;
			const firstLineAvailableWidth = printWidth - firstLinePrefix;
			// Continuation lines only have comment prefix, so they have full effectiveWidth
			const continuationLineAvailableWidth = effectiveWidth;

			if (firstLineAvailableWidth <= EMPTY) {
				newTokens.push(token);
				continue;
			}

			// Adapt fill approach for annotations with different widths per line
			// First line has less width due to @annotationName prefix
			// Continuation lines have full effectiveWidth
			// Split on whitespace characters manually
			const words: string[] = [];
			let currentWord = '';
			for (let i = 0; i < annotationContent.length; i++) {
				const char = annotationContent[i];
				if (
					char === ' ' ||
					char === '\t' ||
					char === '\n' ||
					char === '\r'
				) {
					if (currentWord.length > 0) {
						words.push(currentWord);
						currentWord = '';
					}
				} else {
					currentWord += char;
				}
			}
			if (currentWord.length > 0) {
				words.push(currentWord);
			}

			if (words.length === 0) {
				newTokens.push(token);
				continue;
			}

			// Calculate what fits on the first line
			let firstLineWords: string[] = [];
			let currentFirstLine = '';
			let remainingWords = [...words];

			while (remainingWords.length > 0) {
				const word = remainingWords[0];
				if (!word) break;
				const testLine =
					currentFirstLine === ''
						? word
						: `${currentFirstLine} ${word}`;
				if (
					prettier.util.getStringWidth(testLine) <=
					firstLineAvailableWidth
				) {
					firstLineWords.push(word);
					currentFirstLine = testLine;
					remainingWords.shift();
				} else {
					break;
				}
			}

			// Use fill builder for remaining content with continuation width
			let wrappedContent: string | Doc = '';
			if (firstLineWords.length > 0) {
				wrappedContent = firstLineWords.join(' ');
			}

			if (remainingWords.length > 0) {
				// Use fill for continuation lines with full effectiveWidth
				const continuationFill = prettier.doc.builders.fill(
					prettier.doc.builders.join(
						prettier.doc.builders.line,
						remainingWords,
					),
				);
				const continuationText = prettier.doc.printer.printDocToString(
					continuationFill,
					{
						printWidth: continuationLineAvailableWidth,
						tabWidth: options.tabWidth,
						...(options.useTabs !== null && options.useTabs !== undefined
							? { useTabs: options.useTabs }
							: {}),
					},
				).formatted;

				// Combine first line and continuation lines
				const continuationLines = continuationText
					.split('\n')
					.filter((line) => line.trim().length > 0);
				const allLines: string[] = [];
				if (firstLineWords.length > 0) {
					allLines.push(firstLineWords.join(' '));
				}
				allLines.push(...continuationLines);

				wrappedContent = prettier.doc.builders.join(
					prettier.doc.builders.hardline,
					allLines,
				);
			}

			const newContent = prettier.doc.printer.printDocToString(
				wrappedContent,
				{
					printWidth: Math.max(
						firstLineAvailableWidth,
						continuationLineAvailableWidth,
					),
					tabWidth: options.tabWidth,
					...(options.useTabs !== null && options.useTabs !== undefined
						? { useTabs: options.useTabs }
						: {}),
				},
			).formatted;
			newTokens.push({
				...token,
				content: newContent,
			} satisfies AnnotationToken);
		} else {
			newTokens.push(token);
		}
	}

	return newTokens;
};

export {
	findApexDocComments,
	EMPTY_CODE_TAG,
	normalizeSingleApexDocComment,
	detectAnnotationsInTokens,
	detectCodeBlockTokens,
	normalizeAnnotationTokens,
	wrapAnnotationTokens,
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
