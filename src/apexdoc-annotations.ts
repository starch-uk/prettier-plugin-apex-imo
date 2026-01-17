/**
 * @file Functions for detecting, normalizing, wrapping, and rendering ApexDoc annotations.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import * as prettier from 'prettier';
import type { Doc } from 'prettier';
import type { ApexDocComment, ApexDocAnnotation } from './comments.js';
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
import { APEXDOC_ANNOTATIONS_SET } from './refs/apexdoc-annotations.js';
import { normalizeGroupContent } from './apexdoc-group.js';

const INDEX_OFFSET = 1;
const SINGLE_LINE = 1;
const ZERO_LINES = 0;
const ZERO_WIDTH = 0;
const EMPTY_STRING = '';
const ZERO_LENGTH = 0;

/**
 * Extracts text before an annotation, filtering out annotation patterns.
 * @param line - The line containing the annotation.
 * @param matchIndex - The index where the annotation starts.
 * @returns The cleaned beforeText, or empty string if it contains annotations.
 */
const extractBeforeText = (line: string, matchIndex: number): string => {
	const beforeAnnotation = line.substring(ARRAY_START_INDEX, matchIndex);
	// Use removeCommentPrefix instead of regex to remove comment prefix
	let beforeText = removeCommentPrefix(beforeAnnotation).trim();
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
 * Searches for annotation content that spans multiple lines and combines them into a single content string.
 * This handles cases where annotation text continues on subsequent lines without a new annotation marker.
 * @param annotationName - The annotation name to search for.
 * @param content - The initial annotation content found on the first line.
 * @param _line - The current line text (unused).
 * @param normalizedComment - The normalized comment text to search within.
 * @param consumedContent - Set to track consumed content and prevent duplication.
 * @returns The full annotation content with continuation lines combined.
 */
const collectContinuationFromComment = (
	annotationName: string,
	content: string,
	_line: string,
	normalizedComment: string,
	consumedContent: Set<string>,
	// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 5 parameters for annotation processing
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
	const continuationMatchGroup = continuationMatch?.[INDEX_ONE];
	if (continuationMatchGroup === undefined || continuationMatchGroup === '') {
		return content;
	}

	let continuationContent = continuationMatchGroup;
	continuationContent = continuationContent.replace(/\s*\*\s*$/, '').trim();
	// Removed unreachable brace check: regex pattern [^@{]*? on line 70 explicitly excludes '{'
	// from the continuation match, so continuationContent can never contain '{'
	const continuationLines = continuationContent
		.split('\n')
		.map((line) => removeCommentPrefix(line))
		.filter(
			(l) =>
				isNotEmpty(l) && !l.startsWith('@') && !l.startsWith('{@code'),
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
		// docLines comes from split('\n') or linesString, both return strings, never undefined
		// Array indexing check removed: docLines array has no holes
		// Use removeCommentPrefix instead of regex to remove comment prefix
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- docLines array has no holes, continuationLine is always defined
		const continuationLine = docLines[continuationIndex]!;
		const trimmedLine = removeCommentPrefix(continuationLine).trim();
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
	return { annotationContent, nextIndex: continuationIndex - INDEX_OFFSET };
};

/**
 * Detects annotations in docs and converts ApexDocContents to ApexDocAnnotations.
 * Scans docs for annotation patterns like `@param`, `@return`, etc.
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
				// docLines comes from split('\n') or linesString, both return strings, never undefined
				// Array indexing check removed: line is never undefined
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- line is typed as possibly undefined but never is in practice
				if (line === undefined || line === '') continue;
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
						// Removed unreachable undefined checks: regex pattern has two required capture groups
						// - INDEX_ONE (annotation name) always matches if regex matches
						// - INDEX_TWO (content) always matches (can be empty) if regex matches
						// - match.index is always defined for matchAll results
						// Regex pattern has two required capture groups, so both always exist if regex matches
						// Removed unreachable undefined checks: INDEX_ONE and INDEX_TWO always match if regex matches
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex pattern guarantees both capture groups exist
						const annotationName = match[INDEX_ONE]!;
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex pattern guarantees both capture groups exist
						const contentMatch = match[INDEX_TWO]!;
						const content = contentMatch.trim();
						const lowerName = annotationName.toLowerCase();
						// match.index is always defined for matchAll results
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- match.index is always defined for matchAll results
						const matchIndex = match.index!;
						const beforeText = extractBeforeText(line, matchIndex);

						// Collect continuation lines for this annotation
						let annotationContent = content;
						if (
							docLines.length === SINGLE_LINE &&
							normalizedComment !== undefined &&
							normalizedComment !== ''
						) {
							// line is never undefined per array iteration guarantee
							// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- line is never undefined per array iteration guarantee
							annotationContent = collectContinuationFromComment(
								annotationName,
								content,
								line,
								normalizedComment,
								consumedContent,
							);
						} else {
							const nextLineIndex = lineIndex + INDEX_OFFSET;
							const continuation =
								collectContinuationFromDocLines(
									content,
									docLines,
									nextLineIndex,
								);
							const {
								annotationContent: contContent,
								nextIndex,
							} = continuation;
							annotationContent = contContent;
							lineIndex = nextIndex;
						}

						// Create ApexDocAnnotation with Doc content
						const annotationContentDoc = annotationContent as Doc;
						const followingTextDoc =
							beforeText.length > EMPTY
								? (beforeText as Doc)
								: undefined;
						newDocs.push({
							content: annotationContentDoc,
							name: lowerName,
							type: 'annotation',
							...(followingTextDoc !== undefined
								? { followingText: followingTextDoc }
								: {}),
						} satisfies ApexDocAnnotation);
					}
				} else {
					// line is never undefined per array iteration guarantee
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- line is never undefined per array iteration guarantee
					processedLines.push(line!);
				}
			}

			if (!hasAnnotations) {
				// Check if this doc's content was consumed as annotation continuation
				// Check if all non-empty lines (that aren't annotations or code blocks) were consumed
				const docContentString = getContentString(doc);
				const docLinesToCheck = docContentString
					.split('\n')
					.map((docLine) => removeCommentPrefix(docLine))
					.filter(
						(docLineToCheck) =>
							isNotEmpty(docLineToCheck) &&
							!docLineToCheck.startsWith('@') &&
							!docLineToCheck.startsWith('{@code'),
					);
				// Skip if all lines were consumed - use simple loop instead of .every()
				if (docLinesToCheck.length > ZERO_LINES) {
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
				// Use removeCommentPrefix instead of regex to remove comment prefix
				const trimmedLines = processedLines
					.map((l) => removeCommentPrefix(l).trim())
					.filter((l) => l.length > EMPTY && !consumedContent.has(l));
				if (trimmedLines.length > EMPTY) {
					const remainingContent = trimmedLines.join(' ');
					newDocs.push(
						createDocContent(
							'text',
							remainingContent,
							trimmedLines,
						),
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
 * Normalizes annotation names in docs (e.g., `@Param` -> `@param`).
 * Processes ApexDocAnnotation, ApexDocContent types.
 * Skips normalization within code blocks using the code tag.
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
					normalizedContentString =
						normalizeGroupContent(contentString);
				}
				// Convert back to Doc
				const normalizedContentDoc = normalizedContentString as Doc;
				return {
					...doc,
					content: normalizedContentDoc,
					name: lowerName,
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
): RenderedAnnotationDoc => {
	// Extract string content from Doc for rendering
	const contentString = docToString(doc.content);
	const hasContent = isNotEmpty(contentString);
	const contentLines = hasContent ? contentString.split('\n') : [''];
	const lines: string[] = [];
	const annotationName = doc.name;
	const trimmedCommentPrefix = commentPrefix.trimEnd();

	// Add followingText before annotation if it exists
	const followingTextString =
		doc.followingText !== undefined
			? docToString(doc.followingText)
			: undefined;
	const trimmedFollowingText = followingTextString?.trim();
	const hasFollowingText =
		followingTextString !== undefined &&
		trimmedFollowingText !== undefined &&
		isNotEmpty(trimmedFollowingText);
	if (hasFollowingText) {
		const followingLines = followingTextString
			.split('\n')
			.map((followingLine: string) => followingLine.trim())
			.filter((followingLineToFilter: string) =>
				isNotEmpty(followingLineToFilter),
			);
		for (const line of followingLines) {
			lines.push(`${commentPrefix}${line}`);
		}
	}

	// First line includes the @annotation name
	// contentLines always has at least one element (line 332-334)
	// contentLines always has at least one element (line 332-334)
	// Removed unreachable undefined check: contentLines[FIRST_ELEMENT_INDEX] is always defined
	const FIRST_ELEMENT_INDEX = 0;
	const firstContent = contentLines[FIRST_ELEMENT_INDEX]!;
	const firstLine = isNotEmpty(firstContent)
		? `${commentPrefix}@${annotationName} ${firstContent}`
		: `${commentPrefix}@${annotationName}`;
	lines.push(firstLine);

	// Subsequent lines are continuation of the annotation content
	for (let i = INDEX_ONE; i < contentLines.length; i++) {
		const lineContent = contentLines[i];
		// Removed unreachable undefined check: contentLines comes from split('\n') which always returns strings
		if (lineContent !== undefined && isNotEmpty(lineContent)) {
			lines.push(`${commentPrefix}${lineContent}`);
		} else {
			lines.push(trimmedCommentPrefix);
		}
	}

	const cleanedLines = removeTrailingEmptyLines(lines);
	// Removed unreachable null branch: we always push firstLine with @annotation name on line 362,
	// so cleanedLines.length will always be >= 1 (removeTrailingEmptyLines only removes trailing empty lines)
	return {
		content: cleanedLines.join('\n'),
		lines: cleanedLines,
		type: 'text',
	};
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
	// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 5 parameters for annotation wrapping
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

			if (firstLineAvailableWidth <= ZERO_WIDTH) {
				newDocs.push(doc);
				continue;
			}

			// Adapt fill approach for annotations with different widths per line
			// First line has less width due to @annotationName prefix
			// Continuation lines have full effectiveWidth
			// Split on whitespace characters manually
			const words = annotationContent
				.split(/\s+/)
				.filter((word) => word.length > ZERO_LENGTH);

			if (words.length === ZERO_LENGTH) {
				newDocs.push(doc);
				continue;
			}

			// Calculate what fits on the first line
			const firstLineWords: string[] = [];
			let currentFirstLine = EMPTY_STRING;
			for (const word of words) {
				const testLine =
					currentFirstLine === EMPTY_STRING
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
				firstLineWords.length > ZERO_LENGTH
					? firstLineWords.join(' ')
					: EMPTY_STRING;

			const useTabsOption =
				options.useTabs !== null && options.useTabs !== undefined
					? { useTabs: options.useTabs }
					: {};
			const baseOptions = {
				tabWidth: options.tabWidth,
				...useTabsOption,
			};

			const {
				fill,
				join: joinBuilders,
				line: lineBuilder,
				hardline,
			} = docBuilders;
			let wrappedContent: prettier.Doc | string = firstLineContent;
			if (remainingWords.length > ZERO_LENGTH) {
				// Use fill for continuation lines with full effectiveWidth
				const continuationFill = fill(
					joinBuilders(lineBuilder, remainingWords),
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
					.filter(
						(continuationLine) =>
							continuationLine.trim().length > ZERO_LENGTH,
					);
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
};
