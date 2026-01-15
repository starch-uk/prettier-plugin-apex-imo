/**
 * @file Functions for detecting, normalizing, wrapping, and rendering ApexDoc annotations.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import * as prettier from 'prettier';
import type {
	CommentToken,
	ContentToken,
	AnnotationToken,
} from './comments.js';
import {
	removeCommentPrefix,
	isContentToken,
	INDEX_TWO,
} from './comments.js';
import { removeTrailingEmptyLines } from './apexdoc.js';
import {
	ARRAY_START_INDEX,
	EMPTY,
	INDEX_ONE,
	isEmpty,
	isNotEmpty,
} from './utils.js';
import {
	APEXDOC_ANNOTATIONS,
} from './refs/apexdoc-annotations.js';
import { normalizeGroupContent } from './apexdoc-group.js';

// Use Set for O(1) lookup instead of array.includes() O(n)
const APEXDOC_ANNOTATIONS_SET = new Set(APEXDOC_ANNOTATIONS);

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
				isNotEmpty(l) &&
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
		const continuationLine = tokenLines[continuationIndex];
		if (continuationLine === undefined) break;
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
 * @param normalizedComment - The normalized comment text (optional, for continuation detection).
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
			const isParagraphWithNewlines =
				token.type === 'paragraph' && token.content.includes('\n');
			const tokenLines = isParagraphWithNewlines
				? token.content.split('\n')
				: token.lines;
			let processedLines: string[] = [];
			let hasAnnotations = false;

			for (let lineIndex = 0; lineIndex < tokenLines.length; lineIndex++) {
				const line = tokenLines[lineIndex];
				if (line === undefined) continue;
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
						const annotationName = match[INDEX_ONE] !== undefined ? match[INDEX_ONE] : '';
						const content = match[INDEX_TWO] !== undefined ? match[INDEX_TWO].trim() : '';
						const lowerName = annotationName.toLowerCase();
						const beforeText = extractBeforeText(
							line,
							match.index !== undefined ? match.index : ARRAY_START_INDEX,
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
							isNotEmpty(l) &&
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
					normalizedContent = normalizeGroupContent(token.content);
				}
				return {
					...token,
					name: lowerName,
					content: normalizedContent,
				} satisfies AnnotationToken;
			}
		}
		return token;
	});
};

/**
 * Renders an annotation token to text token with formatted lines.
 * @param token - The annotation token to render.
 * @param commentPrefix - The comment prefix string.
 * @returns The rendered content token, or null if empty.
 */
const renderAnnotationToken = (
	token: AnnotationToken,
	commentPrefix: string,
): ContentToken | null => {
	const contentLines = isNotEmpty(token.content)
		? token.content.split('\n')
		: [''];
	const lines: string[] = [];
	const annotationName = token.name;
	const trimmedCommentPrefix = commentPrefix.trimEnd();

	// Add followingText before annotation if it exists
	const trimmedFollowingText = token.followingText?.trim();
	if (trimmedFollowingText !== undefined && isNotEmpty(trimmedFollowingText)) {
		const followingText = token.followingText;
		if (followingText === undefined) return null;
		const followingLines = followingText
			.split('\n')
			.map((line: string) => line.trim())
			.filter((line: string) => isNotEmpty(line));
		for (const line of followingLines) {
			lines.push(`${commentPrefix}${line}`);
		}
	}

	// First line includes the @annotation name
	const firstContent =
		contentLines.length > ARRAY_START_INDEX
			? contentLines[ARRAY_START_INDEX] ?? ''
			: '';
	const firstLine = isNotEmpty(firstContent)
		? `${commentPrefix}@${annotationName} ${firstContent}`
		: `${commentPrefix}@${annotationName}`;
	lines.push(firstLine);

	// Subsequent lines are continuation of the annotation content
	for (let i = INDEX_ONE; i < contentLines.length; i++) {
		const lineContent = contentLines[i];
		if (lineContent === undefined) continue;
		if (isNotEmpty(lineContent)) {
			lines.push(`${commentPrefix}${lineContent}`);
		} else {
			lines.push(trimmedCommentPrefix);
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
 * Wraps annotation tokens based on effective page width.
 * @param tokens - Array of comment tokens.
 * @param effectiveWidth - The effective page width (printWidth - comment prefix length).
 * @param _commentIndent - The indentation level of the comment (unused but kept for API compatibility).
 * @param actualPrefixLength - The actual prefix length including base indent and comment prefix.
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
			const words = annotationContent
				.split(/\s+/)
				.filter((word) => word.length > 0);

			if (words.length === 0) {
				newTokens.push(token);
				continue;
			}

			// Calculate what fits on the first line
			const firstLineWords: string[] = [];
			let currentFirstLine = '';
			for (const word of words) {
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
				} else {
					break;
				}
			}
			const remainingWords = words.slice(firstLineWords.length);

			// Use fill builder for remaining content with continuation width
			const firstLineContent =
				firstLineWords.length > 0 ? firstLineWords.join(' ') : '';

			const useTabsOption =
				options.useTabs !== null && options.useTabs !== undefined
					? { useTabs: options.useTabs }
					: {};
			const baseOptions = {
				tabWidth: options.tabWidth,
				...useTabsOption,
			};

			let wrappedContent: string | prettier.Doc = firstLineContent;
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
						...baseOptions,
						printWidth: continuationLineAvailableWidth,
					},
				).formatted;

				// Combine first line and continuation lines
				const continuationLines = continuationText
					.split('\n')
					.filter((line) => line.trim().length > 0);
				const allLines = firstLineContent
					? [firstLineContent, ...continuationLines]
					: continuationLines;

				wrappedContent = prettier.doc.builders.join(
					prettier.doc.builders.hardline,
					allLines,
				);
			}

			const newContent = prettier.doc.printer.printDocToString(
				wrappedContent,
				{
					...baseOptions,
					printWidth: Math.max(
						firstLineAvailableWidth,
						continuationLineAvailableWidth,
					),
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
	detectAnnotationsInTokens,
	normalizeAnnotationTokens,
	wrapAnnotationTokens,
	renderAnnotationToken,
	extractBeforeText,
	collectContinuationFromComment,
	collectContinuationFromTokenLines,
};
