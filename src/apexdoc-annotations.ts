/**
 * @file Functions for detecting, normalizing, wrapping, and rendering ApexDoc annotations.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import * as prettier from 'prettier';
import type {
	ApexDocComment,
	ApexDocAnnotation,
} from './comments.js';
import {
	removeCommentPrefix,
	INDEX_TWO,
	getContentString,
	getContentLines,
	createDocContent,
	docToString,
} from './comments.js';
import { removeTrailingEmptyLines } from './apexdoc.js';
import {
	ARRAY_START_INDEX,
	docBuilders,
	EMPTY,
	INDEX_ONE,
	isNotEmpty,
} from './utils.js';
import {
	APEXDOC_ANNOTATIONS_SET,
} from './refs/apexdoc-annotations.js';
import { normalizeGroupContent } from './apexdoc-group.js';

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
	if (continuationLines.length > EMPTY) {
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
 * @param docLines - The doc lines array.
 * @param startIndex - The index to start looking from.
 * @returns Object with annotationContent and the next line index.
 */
const collectContinuationFromDocLines = (
	content: string,
	docLines: readonly string[],
	startIndex: number,
): { annotationContent: string; nextIndex: number } => {
	let annotationContent = content;
	let continuationIndex = startIndex;
	while (continuationIndex < docLines.length) {
		const continuationLine = docLines[continuationIndex];
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
 * Detects annotations in docs and converts ApexDocContents to ApexDocAnnotations.
 * Scans docs for @param, @return, etc. patterns.
 * @param docs - Array of Doc-based comment docs.
 * @param normalizedComment - The normalized comment text (optional, for continuation detection).
 * @returns Array of Doc docs with annotations detected.
 */
const detectAnnotationsInDocs = (
	docs: readonly ApexDocComment[],
	normalizedComment?: string,
): readonly ApexDocComment[] => {
	const newDocs: ApexDocComment[] = [];
	// Track content that has been extracted as annotation continuation to avoid duplicating it as text docs
	const consumedContent = new Set<string>();
	// Detect annotations using regex (annotation parsing in comment text is inherently text-based)

	for (const doc of docs) {
		if (doc.type === 'text' || doc.type === 'paragraph') {
			// Extract string content from Doc for text operations
			const contentString = getContentString(doc);
			const linesString = getContentLines(doc);
			// For paragraph docs, use content (which has all lines joined) and split by original line structure
			// For text docs, use lines array directly
			const isParagraphWithNewlines =
				doc.type === 'paragraph' && contentString.includes('\n');
			const docLines = isParagraphWithNewlines
				? contentString.split('\n')
				: linesString;
			let processedLines: string[] = [];
			let hasAnnotations = false;

			for (let lineIndex = 0; lineIndex < docLines.length; lineIndex++) {
				const line = docLines[lineIndex];
				if (line === undefined) continue;
				// Annotation pattern: @ followed by identifier, possibly with content
				// After detectCodeBlockDocs, lines have their " * " prefix stripped, so we need to match lines with or without prefix
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
						if (docLines.length === 1 && normalizedComment) {
							annotationContent = collectContinuationFromComment(
								annotationName,
								content,
								line,
								normalizedComment,
								consumedContent,
							);
						} else {
							const continuation =
								collectContinuationFromDocLines(
									content,
									docLines,
									lineIndex + 1,
								);
							annotationContent = continuation.annotationContent;
							lineIndex = continuation.nextIndex;
						}

						// Create ApexDocAnnotation with Doc content
						const annotationContentDoc = annotationContent as Doc;
						const followingTextDoc =
							beforeText.length > EMPTY ? (beforeText as Doc) : undefined;
						newDocs.push({
							type: 'annotation',
							name: lowerName,
							content: annotationContentDoc,
							...(followingTextDoc !== undefined
								? { followingText: followingTextDoc }
								: {}),
						} satisfies ApexDocAnnotation);
					}
				} else {
					processedLines.push(line);
				}
			}

			if (!hasAnnotations) {
				// Check if this doc's content was consumed as annotation continuation
				// Check if all non-empty lines (that aren't annotations or code blocks) were consumed
				const contentString = getContentString(doc);
				const docLinesToCheck = contentString
					.split('\n')
					.map((line) => removeCommentPrefix(line))
					.filter(
						(l) =>
							isNotEmpty(l) &&
							!l.startsWith('@') &&
							!l.startsWith('{@code'),
					);
				// Skip if all lines were consumed - use simple loop instead of .every()
				if (docLinesToCheck.length > 0) {
					let allConsumed = true;
					for (const line of docLinesToCheck) {
						if (!consumedContent.has(line)) {
							allConsumed = false;
							break;
						}
					}
					if (allConsumed) continue;
				}
				newDocs.push(doc);
			} else if (processedLines.length > EMPTY) {
				const trimmedLines = processedLines
					.map((l) => l.replace(/^\s*\*\s*/, '').trim())
					.filter((l) => l.length > EMPTY && !consumedContent.has(l));
				if (trimmedLines.length > EMPTY) {
					const remainingContent = trimmedLines.join(' ');
					newDocs.push(
						createDocContent('text', remainingContent, trimmedLines),
					);
				}
			}
		} else {
			newDocs.push(doc);
		}
	}
	return newDocs;
};

/**
 * Normalizes annotation names in docs (e.g., @Param -> @param).
 * Processes ApexDocAnnotation, ApexDocContent types.
 * Skips normalization within {@code} blocks.
 * @param docs - Array of Doc-based comment docs.
 * @returns Array of Doc docs with normalized annotation names.
 */
const normalizeAnnotations = (
	docs: readonly ApexDocComment[],
): readonly ApexDocComment[] => {
	return docs.map((doc) => {
		if (doc.type === 'annotation') {
			const lowerName = doc.name.toLowerCase();
			// Use Set lookup instead of array.includes() for better performance
			if (APEXDOC_ANNOTATIONS_SET.has(lowerName)) {
				// Extract string content from Doc for normalization
				const contentString = docToString(doc.content);
				let normalizedContentString = contentString;
				// Special handling for @group annotations - normalize the group name
				if (lowerName === 'group' && contentString) {
					normalizedContentString = normalizeGroupContent(contentString);
				}
				// Convert back to Doc
				const normalizedContentDoc = normalizedContentString as Doc;
				return {
					...doc,
					name: lowerName,
					content: normalizedContentDoc,
				} satisfies ApexDocAnnotation;
			}
		}
		return doc;
	});
};

/**
 * Renders an ApexDoc annotation doc to text doc with formatted lines.
 * @param doc - The ApexDoc annotation doc to render.
 * @param commentPrefix - The comment prefix string.
 * @returns The rendered content doc, or null if empty.
 */
interface RenderedAnnotationDoc {
	readonly type: 'text';
	readonly content: string;
	readonly lines: string[];
}

const renderAnnotation = (
	doc: ApexDocAnnotation,
	commentPrefix: string,
): RenderedAnnotationDoc | null => {
	// Extract string content from Doc for rendering
	const contentString = docToString(doc.content);
	const contentLines = isNotEmpty(contentString)
		? contentString.split('\n')
		: [''];
	const lines: string[] = [];
	const annotationName = doc.name;
	const trimmedCommentPrefix = commentPrefix.trimEnd();

	// Add followingText before annotation if it exists
	const followingTextString = doc.followingText
		? docToString(doc.followingText)
		: undefined;
	const trimmedFollowingText = followingTextString?.trim();
	if (trimmedFollowingText !== undefined && isNotEmpty(trimmedFollowingText)) {
		const followingLines = followingTextString!
			.split('\n')
			.map((line: string) => line.trim())
			.filter((line: string) => isNotEmpty(line));
		for (const line of followingLines) {
			lines.push(`${commentPrefix}${line}`);
		}
	}

	// First line includes the @annotation name
	const firstContent = contentLines[ARRAY_START_INDEX] ?? '';
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
 * Wraps ApexDoc annotation docs based on effective page width.
 * @param docs - Array of Doc-based comment docs.
 * @param effectiveWidth - The effective page width (printWidth - comment prefix length).
 * @param _commentIndent - The indentation level of the comment (unused but kept for API compatibility).
 * @param actualPrefixLength - The actual prefix length including base indent and comment prefix.
 * @param options - Options including tabWidth and useTabs.
 * @returns Array of Doc docs with wrapped annotations.
 */
const wrapAnnotations = (
	docs: readonly ApexDocComment[],
	effectiveWidth: number,
	_commentIndent: number,
	actualPrefixLength: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): readonly ApexDocComment[] => {
	const newDocs: ApexDocComment[] = [];
	const printWidth = effectiveWidth + actualPrefixLength;

	for (const doc of docs) {
		if (doc.type === 'annotation') {
			// Extract string content from Doc for wrapping
			const annotationContent = docToString(doc.content);
			const annotationPrefixLength = `@${doc.name} `.length;
			// First line includes @annotation name after comment prefix
			// First line prefix = actualPrefixLength + annotationPrefixLength
			// First line available = printWidth - firstLinePrefix
			const firstLinePrefix = actualPrefixLength + annotationPrefixLength;
			const firstLineAvailableWidth = printWidth - firstLinePrefix;
			// Continuation lines only have comment prefix, so they have full effectiveWidth
			const continuationLineAvailableWidth = effectiveWidth;

			if (firstLineAvailableWidth <= EMPTY) {
				newDocs.push(doc);
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
				newDocs.push(doc);
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

			const { fill, join: joinBuilders, line, hardline } = docBuilders;
			let wrappedContent: string | prettier.Doc = firstLineContent;
			if (remainingWords.length > 0) {
				// Use fill for continuation lines with full effectiveWidth
				const continuationFill = fill(joinBuilders(line, remainingWords));
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

				wrappedContent = joinBuilders(hardline, allLines);
			}

			const newContentString = prettier.doc.printer.printDocToString(
				wrappedContent,
				{
					...baseOptions,
					printWidth: Math.max(
						firstLineAvailableWidth,
						continuationLineAvailableWidth,
					),
				},
			).formatted;
			// Convert back to Doc
			const newContentDoc = newContentString as Doc;
			newDocs.push({
				...doc,
				content: newContentDoc,
			} satisfies ApexDocAnnotation);
		} else {
			newDocs.push(doc);
		}
	}

	return newDocs;
};

export {
	detectAnnotationsInDocs,
	normalizeAnnotations,
	wrapAnnotations,
	renderAnnotation,
	extractBeforeText,
	collectContinuationFromComment,
	collectContinuationFromDocLines,
};
