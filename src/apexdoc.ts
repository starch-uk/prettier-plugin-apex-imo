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
	INDEX_TWO,
	NOT_FOUND_INDEX,
} from './comments.js';
import {
	ARRAY_START_INDEX,
	calculateEffectiveWidth,
	EMPTY,
	INDEX_ONE,
	STRING_OFFSET,
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
import { normalizeAnnotationNamesInText } from './annotations.js';

const COMMENT_START_MARKER = '/**';
const COMMENT_END_MARKER = '*/';
const COMMENT_START_LENGTH = COMMENT_START_MARKER.length;
const ZERO_INDENT = 0;
const BODY_INDENT_WHEN_ZERO = 2;
const COMMENT_END_LENGTH = COMMENT_END_MARKER.length;

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
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
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
	const finalTokens = tokens;

	// eslint-disable-next-line @typescript-eslint/no-use-before-define
	const commentString = tokensToApexDocString(
		finalTokens,
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
 * Renders a code block token to text token with formatted lines.
 */
const renderCodeBlockToken = (
	token: CodeBlockToken,
	commentPrefix: string,
	options: Readonly<{
		readonly printWidth?: number;
	}>,
): ContentToken | null => {
	let codeToUse = token.formattedCode !== undefined ? token.formattedCode : token.rawCode;
	if (!token.formattedCode) {
		codeToUse = normalizeAnnotationNamesInText(codeToUse);
	}

	// Preserve blank lines: insert blank line after } when followed by annotations or access modifiers
	const codeLines = codeToUse.trim().split('\n');
	const resultLines: string[] = [];

	for (let i = 0; i < codeLines.length; i++) {
		if (i < 0 || i >= codeLines.length) {
			continue;
		}
		const codeLine = codeLines[i];
		if (codeLine === undefined) continue;
		resultLines.push(codeLine);

		if (preserveBlankLineAfterClosingBrace(codeLines, i)) {
			resultLines.push('');
		}
	}

	codeToUse = resultLines.join('\n');
	const trimmedCodeToUse = codeToUse.trim();
	const isEmptyBlock = isEmpty(trimmedCodeToUse);
	const lines: string[] = [];

	if (isEmptyBlock) {
		lines.push(`${commentPrefix}{@code}`);
	} else if (codeToUse.length > EMPTY) {
		const codeLinesForProcessing = codeToUse.split('\n');
		const alreadyWrapped = trimmedCodeToUse.startsWith('{@code');
		let finalCodeLines: string[] = [];

		if (alreadyWrapped) {
			finalCodeLines = codeLinesForProcessing;
			if (finalCodeLines.length === 1) {
				const [line] = finalCodeLines;
				if (line && line.includes(';') && line.endsWith('}')) {
					finalCodeLines[0] = line.slice(0, -1) + ' }';
				}
			}
		} else {
			const isSingleLine = codeLinesForProcessing.length === 1;
			const singleLineContent = codeLinesForProcessing.length > 0 && codeLinesForProcessing[0] !== undefined ? codeLinesForProcessing[0].trim() : '';
			const singleLineWithBraces = `{@code ${singleLineContent} }`;
			if (options.printWidth === undefined) {
				throw new Error(
					'prettier-plugin-apex-imo: options.printWidth is required for renderCodeBlockToken',
				);
			}
			const printWidth = options.printWidth;
			const commentPrefixLength = commentPrefix.length;
			const fitsOnOneLine =
				singleLineWithBraces.length <= printWidth - commentPrefixLength;

			finalCodeLines =
				isSingleLine && fitsOnOneLine
					? [singleLineWithBraces]
					: [`{@code`, ...codeLinesForProcessing, `}`];
		}

		const trimmedCommentPrefix = commentPrefix.trimEnd();
		for (const codeLine of finalCodeLines) {
			lines.push(
				isEmpty(codeLine.trim())
					? trimmedCommentPrefix
					: `${commentPrefix}${codeLine}`,
			);
		}
	}

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
		cachedPrefixAndWidth !== undefined && cachedPrefixAndWidth !== null
			? cachedPrefixAndWidth
			: calculatePrefixAndWidth(commentIndent, options.printWidth, options);
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
	for (let i = 0; i < cleanedLines.length; i++) {
		const currentLine = cleanedLines[i]?.trim();
		if (currentLine === undefined) continue;
		const nextLine =
			i + INDEX_ONE < cleanedLines.length
				? cleanedLines[i + INDEX_ONE]?.trim() ?? ''
				: '';

		// Check if we should join with next line
		const currentEndsWithPeriod = currentLine.endsWith('.');
		const nextStartsWithCapital =
			nextLine.length > 0 && /^[A-Z]/.test(nextLine);
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
				let hasCompleteBlock = hasCompleteCodeBlock(
					content,
					codeTagIndex,
				);

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
							hasCompleteBlock = hasCompleteCodeBlock(
								mergedContent,
								codeTagIndex,
							);

							if (hasCompleteBlock) {
								// Found complete block, create merged token
								const mergedToken: ContentToken = {
									content: mergedContent,
									lines: mergedLines,
									type: 'paragraph',
									...(token.isContinuation !== undefined
										? {
												isContinuation:
													token.isContinuation,
											}
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


export {
	findApexDocComments,
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
