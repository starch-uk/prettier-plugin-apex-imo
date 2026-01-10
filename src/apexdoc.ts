/**
 * @file Functions for finding and formatting ApexDoc code blocks within comments.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import type { ParserOptions } from 'prettier';
import { processCodeBlockLines } from './apexdoc-code.js';
import {
	createIndent,
	normalizeBlockComment,
	parseCommentToTokens,
	tokensToCommentString,
	ARRAY_START_INDEX,
	INDEX_ONE,
	INDEX_TWO,
	STRING_OFFSET,
	EMPTY,
} from './comments.js';
import type {
	CommentToken,
	TextToken,
	AnnotationToken,
	CodeBlockToken,
	ParagraphToken,
} from './comments.js';
import {
	APEXDOC_ANNOTATIONS,
	APEXDOC_GROUP_NAMES,
} from './refs/apexdoc-annotations.js';

// Use Set for O(1) lookup instead of array.includes() O(n)
const APEXDOC_ANNOTATIONS_SET = new Set(APEXDOC_ANNOTATIONS);
import { extractCodeFromBlock, EMPTY_CODE_TAG, CODE_TAG } from './apexdoc-code.js';

// Access modifiers for checking formatted code strings (use Set for O(1) lookup)
const ACCESS_MODIFIERS_SET = new Set(['public', 'private', 'protected', 'static', 'final', 'global']);

const startsWithAccessModifier = (line: string): boolean => {
	const trimmed = line.trim();
	if (trimmed.length === 0) return false;
	const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() ?? '';
	return ACCESS_MODIFIERS_SET.has(firstWord);
};
import { normalizeAnnotationNamesInText, normalizeAnnotationNamesInTextExcludingApexDoc } from './annotations.js';

const FORMAT_FAILED_PREFIX = '__FORMAT_FAILED__';
const NOT_FOUND_INDEX = -1;
const COMMENT_START_MARKER = '/**';
const COMMENT_END_MARKER = '*/';
const COMMENT_START_LENGTH = COMMENT_START_MARKER.length;
const COMMENT_END_LENGTH = COMMENT_END_MARKER.length;




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
): string => {
	const { printWidth, tabWidth } = options;
	const tabWidthValue = tabWidth;

	// Basic structure normalization - {@code} blocks are handled by the embed system
	let normalizedComment = normalizeBlockComment(commentValue, commentIndent, {
		tabWidth: tabWidthValue,
		useTabs: options.useTabs,
	});

	// Parse to tokens and get effective width
	const { tokens: initialTokens, effectiveWidth } = parseApexDocTokens(
		normalizedComment,
		commentIndent,
		printWidth ?? 80,
		{
			tabWidth: tabWidthValue,
			useTabs: options.useTabs,
		},
	);

	// Merge paragraph tokens that contain split {@code} blocks
	let tokens = mergeCodeBlockTokens(initialTokens);

	// Apply common token processing pipeline
	tokens = applyTokenProcessingPipeline(tokens, normalizedComment);

	// Wrap annotations if printWidth is available
	// Calculate effectiveWidth accounting for body indentation (same as tokensToApexDocString)
	if (printWidth) {
		const baseIndent = createIndent(
			commentIndent,
			tabWidthValue,
			options.useTabs,
		);
		const commentPrefix = `${baseIndent} * `;
		// Account for body indentation when commentIndent is 0
		const bodyIndent = commentIndent === 0 ? 2 : 0;
		const actualPrefixLength = commentPrefix.length + bodyIndent;
		const annotationEffectiveWidth = printWidth - actualPrefixLength;

		// Pass the actual prefix length to wrapAnnotationTokens so it can calculate first line width correctly
		tokens = wrapAnnotationTokens(
			tokens,
			annotationEffectiveWidth,
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

	return tokensToApexDocString(finalTokens, commentIndent, {
		tabWidth: tabWidthValue,
		useTabs: options.useTabs,
		printWidth: printWidth,
	});
};

/**
 * Processes an ApexDoc comment and returns formatted lines ready for indentation.
 * This function handles normalization, tokenization, and embed processing.
 * @param commentValue - The raw comment value.
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Parser options.
 * @param getFormattedCodeBlock - Function to get embed-formatted code blocks.
 * @returns Array of formatted comment lines (without base indentation).
 */

export async function processApexDocCommentLines(
	commentValue: string,
	commentIndent: number,
	options: ParserOptions,
	getFormattedCodeBlock: (key: string) => string | undefined,
): Promise<string[]> {
	// Normalize the comment structure (no preprocessing of {@code} blocks)
	const normalizedComment = normalizeSingleApexDocComment(
		commentValue,
		0, // Use 0 for consistency with embed function
		options,
	);

	// Check if embed has already formatted code blocks
	const codeTagPos = normalizedComment.indexOf('{@code');
	const commentKey = codeTagPos !== -1 ? `${String(normalizedComment.length)}-${String(codeTagPos)}` : null;
	const embedFormattedComment = commentKey ? getFormattedCodeBlock(commentKey) : null;

	if (embedFormattedComment) {
		// Use tokenization for embed-formatted comments
		const paragraphTokens = parseCommentToTokens(embedFormattedComment);

		// Process each paragraph token
		const processedLines: string[] = [];

		for (const token of paragraphTokens) {
			// Only process paragraph tokens
			if (token.type !== 'paragraph') {
				if (token.type === 'text') {
					processedLines.push(...token.lines);
				}
				continue;
			}
			const tokenLines = processParagraphToken(token, options, getFormattedCodeBlock, commentKey, options);
			// Add lines with relative indentation (* )
			for (const line of tokenLines) {
				if (line.trim() === '') {
					continue; // Skip empty lines
				} else {
					processedLines.push(line);
				}
			}
		}

		return processedLines;
	} else {
		// Use normalized comment with code block processing
		// Code blocks will be processed through token system and embed
		const lines = normalizedComment.split('\n');
		const processedLines = processCodeBlockLines(lines);

		return processedLines.join('\n').split('\n');
	}
}

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
	const baseIndent = createIndent(
		commentIndent,
		options.tabWidth,
		options.useTabs,
	);
	const commentPrefix = `${baseIndent} * `;
	// Calculate the actual prefix that will be rendered by tokensToCommentString
	// tokensToCommentString uses the same commentIndent, so it will create the same baseIndent
	// But Prettier adds class/body indentation when rendering (typically 2 spaces for class body)
	// We need to account for this in effectiveWidth calculation
	// The actual rendered prefix will be: baseIndent (from commentIndent) + bodyIndent (2 for class) + " * "
	// When commentIndent is 0, bodyIndent is 2 (class body indentation)
	// When commentIndent > 0, bodyIndent is already included in commentIndent
	const bodyIndent = commentIndent === 0 ? 2 : 0;
	const actualPrefixLength = commentPrefix.length + bodyIndent;
	const printWidth = options.printWidth ?? 80;
	const effectiveWidth = printWidth - actualPrefixLength;

	const apexDocTokens: CommentToken[] = [];

	for (const token of tokens) {
		if (token.type === 'annotation') {
			// Render AnnotationTokens as text tokens with fully formatted comment lines.
			// tokensToCommentString will preserve lines that already start with '*'.
			const contentLines =
				token.content.length > EMPTY
					? token.content.split('\n')
					: [''];

			const lines: string[] = [];
			const annotationName = token.name;

			// Add followingText before annotation if it exists
			if (token.followingText && token.followingText.trim().length > EMPTY) {
				// followingText doesn't have prefixes, so add them
				const followingLines = token.followingText.split('\n').filter((line: string) => line.trim().length > EMPTY);
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
					// Preserve a blank annotation continuation line
					lines.push(commentPrefix.trimEnd());
				}
			}

			// Remove trailing empty lines from annotation tokens to avoid extra blank lines
			// when followed by code blocks in tokensToCommentString
			const cleanedLines = removeTrailingEmptyLines(lines);
			
			if (cleanedLines.length > EMPTY) {
				apexDocTokens.push({
					type: 'text',
					content: cleanedLines.join('\n'),
					lines: cleanedLines,
				} satisfies TextToken);
			}
		} else if (token.type === 'code') {
			// Render CodeBlockTokens as text tokens with {@code ...} format
			let codeToUse = token.formattedCode ?? token.rawCode;
			// In sync version, normalize annotations in the code
			if (!token.formattedCode) {
				codeToUse = normalizeAnnotationNamesInText(codeToUse);
			}
			
			// Preserve blank lines: insert blank line after } when followed by annotations or access modifiers
			// This preserves structure from original code (blank lines after } before annotations/methods)
			// Apply to both formattedCode and rawCode to ensure blank lines are preserved
			const codeLines = codeToUse.trim().split('\n');
			const resultLines: string[] = [];

			for (let i = 0; i < codeLines.length; i++) {
				const codeLine = codeLines[i] ?? '';
				const trimmedLine = codeLine.trim();
				resultLines.push(codeLine);

				// Insert blank line after } when followed by annotations or access modifiers
				if (trimmedLine.endsWith('}') && i < codeLines.length - 1) {
					const nextLine = codeLines[i + 1]?.trim() ?? '';
					// Check if next line starts with annotation or access modifier using Set-based detection
					if (
						nextLine.length > 0 &&
						(nextLine.startsWith('@') || startsWithAccessModifier(nextLine))
					) {
						resultLines.push('');
					}
				}
			}

			codeToUse = resultLines.join('\n');
			
			// Handle empty code blocks - render {@code} even if content is empty
			const isEmptyBlock = codeToUse.trim().length === EMPTY;
			const lines: string[] = [];
			
			if (isEmptyBlock) {
				// Empty code block: render as {@code} on a single line
				lines.push(`${commentPrefix}{@code}`);
			} else if (codeToUse.length > EMPTY) {
				const codeLines = codeToUse.split('\n');

				// Check if the code already includes {@code} wrapper (from embed)
				const alreadyWrapped = codeToUse.trim().startsWith('{@code');
				let finalCodeLines: string[];

				if (alreadyWrapped) {
					// Code is already wrapped, use as-is but ensure single-line format has space before }
					finalCodeLines = codeLines;
					if (finalCodeLines.length === 1) {
						const line = finalCodeLines[0];
						if (line) {
							// For single-line {@code} blocks ending with ;}, add space before }
							if (line.includes(';') && line.endsWith('}')) {
								finalCodeLines[0] = line.slice(0, -1) + ' }';
							}
						}
					}
				} else {
					// Check if this is a single-line code block that fits within the comment width
					const isSingleLine = codeLines.length === 1;
					const singleLineContent = codeLines[0]?.trim() ?? '';
					const singleLineWithBraces = `{@code ${singleLineContent} }`;
					const printWidth = options.printWidth ?? 80;
					const fitsOnOneLine = singleLineWithBraces.length <= printWidth - commentPrefix.length;

					if (isSingleLine && fitsOnOneLine) {
						// Single line format: {@code content }
						finalCodeLines = [singleLineWithBraces];
					} else {
						// Multi-line format
						finalCodeLines = [`{@code`, ...codeLines, `}`];
					}
				}

				// Add comment prefix to each line
				for (const codeLine of finalCodeLines) {
					if (codeLine.trim().length === EMPTY) {
						// Empty line - just comment prefix without trailing space
						lines.push(commentPrefix.trimEnd());
					} else {
						lines.push(`${commentPrefix}${codeLine}`);
					}
				}
			}
			
			if (lines.length > EMPTY) {
				apexDocTokens.push({
					type: 'text',
					content: lines.join('\n'),
					lines,
				} satisfies TextToken);
			}
		} else if (token.type === 'text') {
			// Wrap text tokens based on effective width
			const wrappedLines = wrapTextContent(
				token.content,
				token.lines,
				effectiveWidth,
			);
			// Split wrapped lines by newlines first (in case wrapTextContent returned multi-line strings)
			const allLines: string[] = [];
			for (const wrappedLine of wrappedLines) {
				allLines.push(...wrappedLine.split('\n'));
			}
			const cleanedLines = removeTrailingEmptyLines(allLines);
			// Add prefixes back to wrapped lines using commentPrefix
			const linesWithPrefix = cleanedLines.map((line: string) => `${commentPrefix}${line.trim()}`);
			apexDocTokens.push({
				...token,
				content: cleanedLines.join('\n'),
				lines: linesWithPrefix,
			} satisfies TextToken);
		} else if (token.type === 'paragraph') {
			// Wrap paragraph tokens based on effective width
			const wrappedLines = wrapTextContent(
				token.content,
				token.lines,
				effectiveWidth,
			);
			// Remove trailing empty lines to avoid extra blank lines before code blocks
			const cleanedLines = removeTrailingEmptyLines(wrappedLines);
			apexDocTokens.push({
				...token,
				content: cleanedLines.join('\n'),
				lines: cleanedLines,
			} satisfies ParagraphToken);
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
	while (cleaned.length > 0 && cleaned[cleaned.length - 1]?.trim().length === 0) {
		cleaned.pop();
	}
	return cleaned;
};

/**
 * Removes comment prefix (asterisk and spaces) from a line and trims it.
 * @param line - Line to remove prefix from.
 * @returns Line with prefix removed and trimmed.
 */
const removeCommentPrefix = (line: string): string => {
	return line.replace(/^\s*\*\s*/, '').trim();
};

/**
 * Wraps text content to fit within effective width.
 * @param content - The text content to wrap.
 * @param originalLines - The original lines array (for reference).
 * @param effectiveWidth - The effective width available for content.
 * @returns Array of wrapped lines (without comment prefix).
 */
const wrapTextContent = (
	content: string,
	originalLines: readonly string[],
	effectiveWidth: number,
): string[] => {
	// Extract content from lines (remove comment prefixes)
	const textContent = content || originalLines
		.map(removeCommentPrefix)
		.filter((line) => line.length > EMPTY)
		.join(' ');
	
	if (textContent.length <= effectiveWidth) {
		// Content fits, return as single line
		return [textContent];
	}

	// Wrap content by words
	const words = textContent.split(/\s+/);
	const wrappedLines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		const testLine = currentLine === '' ? word : `${currentLine} ${word}`;
		// Allow lines up to effectiveWidth (inclusive) to fit within printWidth
		if (testLine.length <= effectiveWidth) {
			currentLine = testLine;
		} else {
			if (currentLine !== '') {
				wrappedLines.push(currentLine);
			}
			currentLine = word;
		}
	}
	if (currentLine !== '') {
		wrappedLines.push(currentLine);
	}

	return wrappedLines;
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
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): {
	readonly tokens: readonly CommentToken[];
	readonly effectiveWidth: number;
} => {
	const baseIndent = createIndent(
		commentIndent,
		options.tabWidth,
		options.useTabs,
	);
	const commentPrefixLength = baseIndent.length + ' * '.length;
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
const mergeCodeBlockTokens = (tokens: readonly CommentToken[]): readonly CommentToken[] => {
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

							while (searchPos < mergedContent.length && !hasCompleteBlock) {
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
								mergedTokens.push({
									type: 'paragraph',
									content: mergedContent,
									lines: mergedLines,
									isContinuation: token.isContinuation, // Preserve the flag from original token
								} satisfies ParagraphToken);
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
	let processedTokens = detectCodeBlockTokens(tokens, normalizedComment);

	// Detect annotations in tokens that contain ApexDoc content
	// Code blocks are now handled as separate tokens
	processedTokens = detectAnnotationsInTokens(processedTokens, normalizedComment);

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
	if (beforeText.length > EMPTY && /@[a-zA-Z_][a-zA-Z0-9_]*/.test(beforeText)) {
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
	line: string,
	normalizedComment: string,
	consumedContent: Set<string>,
): string => {
	const currentLineText = line.replace(/^\s*\*\s*/, '').trim();
	const escapedAnnotationName = annotationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
		continuationContent = continuationContent.substring(0, continuationContent.indexOf('{')).trim();
	}
	const continuationLines = continuationContent
		.split('\n')
		.map(removeCommentPrefix)
		.filter((l) => l.length > EMPTY && !l.startsWith('@') && !l.startsWith('{@code'));
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
		if (trimmedLine.length === EMPTY || trimmedLine.startsWith('@') || trimmedLine.startsWith('{@code')) {
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
	// Annotation pattern: @ followed by identifier, possibly with content
	// After detectCodeBlockTokens, lines have their " * " prefix stripped, so we need to match lines with or without prefix
	// Pattern matches: (optional prefix) @ (name) (content)
	const annotationPattern =
		/(?:^\s*\*\s*|\s+(?!\{)|\s*\*\s*\.\s*\*\s*|^|\s+)@([a-zA-Z_][a-zA-Z0-9_]*)(\s*[^\n@]*?)(?=\s*@|\s*\*|\s*$)/g;

	for (const token of tokens) {
		if (token.type === 'text' || token.type === 'paragraph') {
			// For paragraph tokens, use content (which has all lines joined) and split by original line structure
			// For text tokens, use lines array directly
			const tokenLines = token.type === 'paragraph' && token.content.includes('\n')
				? token.content.split('\n')
				: token.lines;
			let processedLines: string[] = [];
			let hasAnnotations = false;

			for (let lineIndex = 0; lineIndex < tokenLines.length; lineIndex++) {
				const line = tokenLines[lineIndex] ?? '';
				const matches = [...line.matchAll(annotationPattern)];
				if (matches.length > EMPTY) {
					hasAnnotations = true;
					// Process each annotation match
					for (const match of matches) {
						const annotationName = match[INDEX_ONE] ?? '';
						const content = (match[INDEX_TWO] ?? '').trim();
						const lowerName = annotationName.toLowerCase();
						const beforeText = extractBeforeText(line, match.index ?? ARRAY_START_INDEX);

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
							const continuation = collectContinuationFromTokenLines(
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
							...(beforeText.length > EMPTY ? { followingText: beforeText } : {}),
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
					.map(removeCommentPrefix)
					.filter((l) => l.length > EMPTY && !l.startsWith('@') && !l.startsWith('{@code'));
				// Skip if all lines were consumed
				if (tokenLinesToCheck.length > 0 && tokenLinesToCheck.every((l) => consumedContent.has(l))) {
					continue;
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
					} satisfies TextToken);
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
 * @param originalComment - The original comment string for position tracking.
 * @returns Array of tokens with code blocks detected.
 */
const detectCodeBlockTokens = (
	tokens: readonly CommentToken[],
	originalComment: Readonly<string>,
): readonly CommentToken[] => {
	const newTokens: CommentToken[] = [];

	for (const token of tokens) {
		if (token.type === 'text' || token.type === 'paragraph') {
			// For paragraphs, work with the lines array to preserve line breaks
			// For text tokens, reconstruct content from lines to preserve prefixes
			// Off-by-one fix: only remove " *" or " * " (asterisk + optional single space), preserve extra indentation spaces
			// Match /^\s*\*\s?/ to remove asterisk and at most one space, preserving code block indentation
			const content = token.type === 'paragraph'
				? token.lines.map((line: string) => line.replace(/^\s*\*\s?/, '')).join('\n')
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
							const cleanedText = remainingText.replace(/\n+$/, '');
							if (cleanedText.length > EMPTY) {
								// For paragraph tokens, content has prefixes stripped, so extract prefix from original lines
								// For text tokens, content now preserves prefixes from token.lines
								if (token.type === 'paragraph') {
									// Extract prefix from original lines
									const firstLineWithPrefix = token.lines.find((line: string) => {
										const trimmed = line.trimStart();
										return trimmed.length > 0 && trimmed.startsWith('*');
									});
									let prefix = ' * '; // Default fallback
									if (firstLineWithPrefix) {
										const prefixMatch = firstLineWithPrefix.match(/^(\s*\*\s*)/);
										if (prefixMatch?.[1]) {
											prefix = prefixMatch[1];
										}
									}
									const splitLines = cleanedText.split('\n').filter((line: string) => line.trim().length > 0);
									if (splitLines.length > 0) {
										newTokens.push({
											type: 'text',
											content: cleanedText,
											lines: splitLines.map((line: string) => `${prefix}${line.trim()}`),
										} satisfies TextToken);
									}
								} else {
									// For text tokens, content now preserves prefixes from token.lines
									const splitLines = cleanedText.split('\n');
									const cleanedLines = removeTrailingEmptyLines(splitLines);
									if (cleanedLines.length > 0) {
										newTokens.push({
											type: 'text',
											content: cleanedText,
											lines: cleanedLines,
										} satisfies TextToken);
									}
								}
							}
						}
					}
					break;
				}

				if (codeTagStart > lastMatchEnd) {
					const textBeforeCode = content.substring(lastMatchEnd, codeTagStart);
					if (textBeforeCode.length > EMPTY) {
						// Remove trailing newlines from textBeforeCode before splitting to avoid empty trailing lines
						const cleanedText = textBeforeCode.replace(/\n+$/, '');
						if (cleanedText.length > EMPTY) {
							// For paragraph tokens, content has prefixes stripped, so we need to extract prefix from original lines
							// For text tokens, content now comes from token.lines which preserves prefixes
							if (token.type === 'paragraph') {
								// Extract prefix pattern from first non-empty line in token.lines that has a prefix
								// The prefix should include base indent (spaces) + ' * '
								const firstLineWithPrefix = token.lines.find((line: string) => {
									const trimmed = line.trimStart();
									return trimmed.length > 0 && trimmed.startsWith('*');
								});
								let prefix = ' * '; // Default fallback
								if (firstLineWithPrefix) {
									// Match from start: any whitespace + asterisk + optional space
									const prefixMatch = firstLineWithPrefix.match(/^(\s*\*\s*)/);
									if (prefixMatch?.[1]) {
										prefix = prefixMatch[1];
									}
								}
								
								const lines = cleanedText.split('\n').filter((line: string) => line.trim().length > 0);
								if (lines.length > 0) {
									const linesWithPrefix = lines.map((line: string) => `${prefix}${line.trim()}`);
									newTokens.push({
										type: 'text',
										content: cleanedText,
										lines: linesWithPrefix,
									} satisfies TextToken);
								}
							} else {
								// For text tokens, content now preserves prefixes from token.lines
								// Split and filter out empty trailing lines while preserving prefixes
								const splitLines = cleanedText.split('\n');
								const cleanedLines = removeTrailingEmptyLines(splitLines);
								if (cleanedLines.length > 0) {
									newTokens.push({
										type: 'text',
										content: cleanedText,
										lines: cleanedLines,
									} satisfies TextToken);
								}
							}
						}
					}
				}

				const codeBlockResult = extractCodeFromBlock(content, codeTagStart);
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
					const groupName = firstSpaceIndex > 0 
						? contentTrimmed.substring(0, firstSpaceIndex)
						: contentTrimmed;
					const description = firstSpaceIndex > 0 
						? contentTrimmed.substring(firstSpaceIndex + 1)
						: '';
					
					// Normalize only the group name (first word)
					const lowerGroupName = groupName.toLowerCase();
					const mappedValue = APEXDOC_GROUP_NAMES[lowerGroupName as keyof typeof APEXDOC_GROUP_NAMES];
					
					// Reconstruct content with normalized group name and original description
					if (mappedValue) {
						normalizedContent = description.length > 0 
							? `${mappedValue} ${description}`
							: mappedValue;
					} else {
						// Group name not in mapping, keep original
						normalizedContent = token.content;
					}
				}
				return { ...token, name: lowerName, content: normalizedContent } satisfies AnnotationToken;
			}
		} else if (token.type === 'text' || token.type === 'paragraph') {
			// Text/paragraph tokens should NOT contain ApexDoc annotations as text after detectAnnotationsInTokens
			// ApexDoc annotations should have been converted to annotation tokens by detectAnnotationsInTokens
			// If any annotations remain as text, they're either:
			// 1. Apex code annotations (should be normalized to PascalCase)
			// 2. ApexDoc annotations that weren't detected (should remain unchanged, but this shouldn't happen)
			// Since detectAnnotationsInTokens runs before this, we should NOT normalize ApexDoc annotations here
			// They should already be converted to annotation tokens and handled separately
			// Normalize annotations in text/paragraph tokens, but skip {@code} blocks
			const content = token.content;
			
			// Check if content contains {@code} blocks - if so, normalize around them
			if (content.includes('{@code')) {
				// Split content by {@code} blocks and normalize each segment
				const parts: string[] = [];
				let lastIndex = 0;
				let startIndex = 0;
				
				while ((startIndex = content.indexOf('{@code', lastIndex)) !== -1) {
					// Normalize text before {@code} block - exclude ApexDoc annotations
					const beforeCode = content.substring(lastIndex, startIndex);
					if (beforeCode.length > EMPTY) {
						parts.push(normalizeAnnotationNamesInTextExcludingApexDoc(beforeCode));
					}
					
					// Find the end of {@code} block
					const codeTagLength = '{@code'.length;
					let endIndex = content.indexOf('}', startIndex + codeTagLength);
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
						parts.push(normalizeAnnotationNamesInTextExcludingApexDoc(afterCode));
					}
				}
				
				const normalizedContent = parts.join('');
				
				// Update lines if content changed
				if (normalizedContent !== content) {
					const normalizedLines = normalizedContent.split('\n');
					if (token.type === 'text') {
						return {
							...token,
							content: normalizedContent,
							lines: normalizedLines,
						} satisfies TextToken;
					} else if (token.type === 'paragraph') {
						return {
							...token,
							content: normalizedContent,
							lines: normalizedLines,
						} satisfies ParagraphToken;
					}
				}
			} else {
				// No {@code} blocks - preserve ApexDoc annotations unchanged
				// Only normalize non-ApexDoc annotations (Apex code annotations)
				const normalizedContent = normalizeAnnotationNamesInTextExcludingApexDoc(content);
				if (normalizedContent !== content) {
					const normalizedLines = normalizedContent.split('\n');
					if (token.type === 'text') {
						return {
							...token,
							content: normalizedContent,
							lines: normalizedLines,
						} satisfies TextToken;
					} else if (token.type === 'paragraph') {
						return {
							...token,
							content: normalizedContent,
							lines: normalizedLines,
						} satisfies ParagraphToken;
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
 * @param commentIndent - The indentation level of the comment.
 * @param options - Options including tabWidth and useTabs.
 * @returns Array of tokens with wrapped annotations.
 */
const wrapAnnotationTokens = (
	tokens: readonly CommentToken[],
	effectiveWidth: number,
	commentIndent: number,
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

			const words = annotationContent.split(/\s+/);
			let currentLine = '';
			const wrappedLines: string[] = [];
			let isFirstLine = true;

			for (const word of words) {
				const testLine =
					currentLine === '' ? word : `${currentLine} ${word}`;
				// Use firstLineAvailableWidth for first line, continuationLineAvailableWidth for subsequent lines
				const availableWidth = isFirstLine ? firstLineAvailableWidth : continuationLineAvailableWidth;
				if (testLine.length <= availableWidth) {
					currentLine = testLine;
				} else {
					if (currentLine !== '') {
						wrappedLines.push(currentLine);
						isFirstLine = false;
					}
					currentLine = word;
				}
			}
			if (currentLine !== '') {
				wrappedLines.push(currentLine);
			}

			const newContent = wrappedLines.join('\n');
			newTokens.push({ ...token, content: newContent } satisfies AnnotationToken);
		} else {
			newTokens.push(token);
		}
	}

	return newTokens;
};

export {
	findApexDocComments,
	FORMAT_FAILED_PREFIX,
	EMPTY_CODE_TAG,
	normalizeSingleApexDocComment,
	parseApexDocTokens,
	detectAnnotationsInTokens,
	detectCodeBlockTokens,
	normalizeAnnotationTokens,
	wrapAnnotationTokens,
	removeTrailingEmptyLines,
};

/**
 * Processes a paragraph token, handling ApexDoc formatting and {@code} embeds.
 */
export function processParagraphToken(
	token: import('./comments.js').ParagraphToken,
	options: ParserOptions,
	getFormattedCodeBlock: (key: string) => string | undefined,
	commentKey: string | null,
	embedOptions: ParserOptions,
): string[] {
	// Since this is called from processApexDocCommentLines, all tokens are ApexDoc
	return processApexDocParagraph(token, options, getFormattedCodeBlock, commentKey, embedOptions);
}

/**
 * Processes an ApexDoc paragraph, handling {@code} blocks.
 */
function processApexDocParagraph(
	token: import('./comments.js').ParagraphToken,
	options: ParserOptions,
	getFormattedCodeBlock: (key: string) => string | undefined,
	commentKey: string | null,
	embedOptions: ParserOptions,
): string[] {
	const content = token.content;
	const lines: string[] = [];

	// Split content into parts, handling {@code} blocks
	const parts = content.split(/(\{@code[^}]*\})/);

		for (const part of parts) {
		if (part.startsWith('{@code')) {
			// This is a {@code} block
			const codeLines = processCodeBlock(part, options, getFormattedCodeBlock, commentKey, embedOptions);
			lines.push(...codeLines);
		} else if (part.trim()) {
			// Regular text - split into individual lines
			const textLines = part.split('\n');
			lines.push(...textLines);
		}
	}

	return lines;
}

/**
 * Processes a {@code} block, returning formatted lines.
 */
function processCodeBlock(
	codeBlock: string,
	_options: ParserOptions,
	getFormattedCodeBlock: (key: string) => string | undefined,
	commentKey: string | null,
	_embedOptions: ParserOptions,
): string[] {
	// Extract content between {@code and }
	const match = codeBlock.match(/^\{@code\s*([\s\S]*?)\s*\}$/);
	if (!match || !match[1]) return [codeBlock];

	const codeContent = match[1];
	if (!codeContent) return [codeBlock];
	
	const codeLines = codeContent.split('\n');

	if (codeLines.length === 1) {
		// Single line - add space before closing } if content ends with ;
		const separator = codeContent.trim().endsWith(';') ? ' ' : '';
		return [`{@code ${codeContent}${separator}}`];
	} else {
		// Multi line - use embed result
		const embedResult = commentKey ? getFormattedCodeBlock(commentKey) : null;

		if (embedResult) {
			// Parse embed result to extract the formatted code
			const embedContent = embedResult.replace(/^\/\*\*\n/, '').replace(/\n \*\/\n?$/, '');

			// Extract base indentation from the first code line (spaces before *)
			const embedLines = embedContent.split('\n');
			const processedLines = embedLines.map((line: string) => {
				// Remove the standard comment prefix but preserve relative indentation
				const lineMatch = line.match(/^(\s*\*\s?)(.*)$/);
				if (lineMatch) {
					return lineMatch[2]; // Keep only the content after the comment prefix
				}
				return line;
			});

			// Find the {@code block
			const codeStart = processedLines.findIndex((line: string | undefined) => line?.startsWith('{@code'));
			const codeEnd = processedLines.findIndex((line: string | undefined, i: number) => i > codeStart && line === '}');

			if (codeStart >= 0 && codeEnd > codeStart) {
				const extractedCodeLines = processedLines.slice(codeStart + 1, codeEnd).filter((line): line is string => typeof line === 'string');
				// For embed results, the formatted code is stored without comment prefixes
				// comments.ts will handle adding the proper indentation
				return [`{@code`, ...extractedCodeLines, `}`];
			}

			// Fallback
			return [`{@code`, ...processedLines.slice(2).filter((line): line is string => line !== undefined), `}`];
		} else {
			// Fallback to original format
			return [`{@code`, ...codeLines, `}`];
		}
	}
}

/**
 * Processes an ApexDoc comment for printing, including embed formatting, normalization, and indentation.
 * @param commentValue - The raw comment value from the AST
 * @param options - Parser options
 * @param _getCurrentOriginalText - Function to get the original source text
 * @param getFormattedCodeBlock - Function to get cached embed-formatted comments
 * @returns The processed comment ready for printing
 */
/**
 * Process {@code} blocks in a comment using Apex parser for proper formatting.
 * @param commentValue - The comment text
 * @param options - Parser options
 * @returns Processed comment with formatted {@code} blocks
 */
export async function processApexDocComment(
	commentValue: string,
	options: ParserOptions,
	_getCurrentOriginalText: () => string | undefined,
	getFormattedCodeBlock: (key: string) => string | undefined,
): Promise<string> {
	// Check if there's a pre-formatted version from embed processing
	const codeTagPos = commentValue.indexOf('{@code');
	const commentKey = codeTagPos !== -1 ? `${commentValue.length}-${codeTagPos}` : null;
	const embedFormattedComment = commentKey ? getFormattedCodeBlock(commentKey) : null;

	if (embedFormattedComment) {
		return embedFormattedComment;
	}

	// Process comment through token system (no preprocessing of {@code} blocks)
	const normalizedComment = normalizeSingleApexDocComment(commentValue, 0, options);

	// Return normalized comment (token processing already done in normalizeSingleApexDocComment)
	return normalizedComment;
}

export type { CodeBlock, ReadonlyCodeBlock };
