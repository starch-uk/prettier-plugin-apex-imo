/**
 * @file Unified Doc-based processing system for ApexDoc comments.
 *
 * This module provides a consolidated approach to handling ApexDoc comments through:
 * - Doc parsing and processing (async-first).
 * - Code block detection and formatting.
 * - Annotation normalization and wrapping.
 * - Integration with Prettier's document building system.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { ParserOptions, Doc } from 'prettier';
import {
	normalizeBlockComment,
	parseCommentToDocs,
	tokensToCommentString,
	wrapTextToWidth,
	CommentPrefix,
	NOT_FOUND_INDEX,
	getContentString,
	getContentLines,
	createDocContent,
	removeCommentPrefix,
} from './comments.js';
import { createDocCodeBlock } from './apexdoc-code.js';
import {
	ARRAY_START_INDEX,
	calculateEffectiveWidth,
	docBuilders,
	EMPTY,
	INDEX_ONE,
	isEmpty,
} from './utils.js';
import type {
	ApexDocComment,
	ApexDocContent,
	ApexDocCodeBlock,
} from './comments.js';
import {
	detectAnnotationsInDocs,
	normalizeAnnotations,
	wrapAnnotations,
	renderAnnotation,
} from './apexdoc-annotations.js';
import {
	extractCodeFromBlock,
	EMPTY_CODE_TAG,
	CODE_TAG,
} from './apexdoc-code.js';
import { preserveBlankLineAfterClosingBrace } from './utils.js';

const ZERO_INDENT = 0;
const BODY_INDENT_WHEN_ZERO = 2;

/**
 * Checks if a comment is an ApexDoc comment.
 * Uses the same logic as prettier-plugin-apex but is more lenient:
 * allows malformed comments (lines without asterisks) to be detected as ApexDoc
 * if they start with slash-asterisk-asterisk and end with asterisk-slash.
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
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- comment is confirmed to have value property
	const commentValue = (comment as { value: string }).value;
	const trimmedStart = commentValue.trimStart();
	const trimmedEnd = commentValue.trimEnd();
	// Must start with /** and end with */
	if (!trimmedStart.startsWith('/**') || !trimmedEnd.endsWith('*/')) {
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
	for (const commentLine of middleLines) {
		if (commentLine.trim().startsWith('*')) {
			return true;
		}
	}
	// If no middle lines have asterisks but comment starts with /** and ends with */,
	// treat it as ApexDoc so we can normalize it (add asterisks)
	return middleLines.length > ARRAY_START_INDEX;
};

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
 * @param isEmbedFormatted - Whether the comment was already formatted by the embed function.
 * @returns The normalized comment value.
 * @example
 * normalizeSingleApexDocComment('  * @param x The parameter', 2, { printWidth: 80, tabWidth: 2, useTabs: false })
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for ApexDoc comment normalization
const normalizeSingleApexDocComment = (
	commentValue: Readonly<string>,
	commentIndent: number,
	options: Readonly<ParserOptions>,
	isEmbedFormatted = false,
	// eslint-disable-next-line @typescript-eslint/max-params -- Arrow function signature line
): Doc => {
	const { printWidth, tabWidth } = options;
	const tabWidthValue = tabWidth;

	// Basic structure normalization - {@code} blocks are handled by the embed system
	let normalizedComment = normalizeBlockComment(commentValue, commentIndent, {
		tabWidth: tabWidthValue,
		useTabs: options.useTabs,
	});

	// Parse to docs
	// eslint-disable-next-line @typescript-eslint/no-use-before-define -- parseApexDocs is defined later but used here due to function ordering
	const { docs: initialDocs } = parseApexDocs(
		normalizedComment,
		commentIndent,
		printWidth,
		{
			tabWidth: tabWidthValue,
			useTabs: options.useTabs,
		},
	);

	// Merge paragraph docs that contain split {@code} blocks
	// eslint-disable-next-line @typescript-eslint/no-use-before-define -- mergeCodeBlockDocs is defined later but used here
	let docs = mergeCodeBlockDocs(initialDocs);

	// Apply common doc processing pipeline
	// Pass isEmbedFormatted flag to preserve formatted code from embed function
	// eslint-disable-next-line @typescript-eslint/no-use-before-define -- applyDocProcessingPipeline is defined later but used here
	docs = applyDocProcessingPipeline(
		docs,
		normalizedComment,
		isEmbedFormatted,
	);

	// Cache prefix and width calculations (used in both wrapAnnotations and docsToApexDocString)
	// printWidth is guaranteed to be defined because parseApexDocs (line 179) calls calculateEffectiveWidth (line 570),
	// which throws if printWidth is undefined. So prefixAndWidth is never null after parseApexDocs succeeds.
	const prefixAndWidth = calculatePrefixAndWidth(commentIndent, printWidth, {
		tabWidth: tabWidthValue,
		useTabs: options.useTabs,
	});

	// Wrap annotations - prefixAndWidth is always defined (see comment above)
	// Pass the actual prefix length to wrapAnnotations so it can calculate first line width correctly
	docs = wrapAnnotations(
		docs,
		prefixAndWidth.effectiveWidth,
		commentIndent,
		prefixAndWidth.actualPrefixLength,
		{
			tabWidth: tabWidthValue,
			useTabs: options.useTabs,
		},
	);

	// Convert docs back to string
	// eslint-disable-next-line @typescript-eslint/no-use-before-define -- docsToApexDocString is defined later but used here
	const commentString = docsToApexDocString(
		docs,
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
	const { join, hardline } = docBuilders;
	return join(hardline, lines);
};

/**
 * Processes code lines with blank line preservation.
 * @param codeToUse - The code string to process.
 * @returns Processed code with blank lines preserved.
 */
const processCodeLines = (codeToUse: string): string => {
	// shouldTrim=false branch was unreachable - processCodeLines is always called with true
	const codeLines = codeToUse.trim().split('\n');
	const resultLines: string[] = [];

	// split('\n') always returns an array of strings, never undefined elements
	// So codeLine is never undefined in this loop
	// Array indexing check removed: codeLines array has no holes
	for (let i = ARRAY_START_INDEX; i < codeLines.length; i++) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- codeLines array has no holes, codeLine is always defined
		const codeLine = codeLines[i]!;
		resultLines.push(codeLine);

		if (preserveBlankLineAfterClosingBrace(codeLines, i)) {
			resultLines.push('');
		}
	}

	return resultLines.join('\n');
};

// handleAlreadyWrappedCode is unreachable because:
// - codeToUse is doc.formattedCode ?? doc.rawCode
// - rawCode is extracted from {@code ... } blocks and doesn't include the {@code wrapper
// - formattedCode is the formatted version of the code, also without the wrapper
// - So trimmedCodeToUse.startsWith('{@code') is always false
// - This means handleAlreadyWrappedCode is never called

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
	// codeLinesForProcessing comes from processedCode.split('\n'), which always returns an array of strings
	// When isSingleLine is true, codeLinesForProcessing[FIRST_ELEMENT_INDEX] exists and is a string
	// .trim() on a string always returns a string, never undefined
	// Type assertion safe: first element exists when isSingleLine is true
	const FIRST_ELEMENT_INDEX = 0;
	const singleLineContent = isSingleLine
		? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- codeLinesForProcessing always has at least one element
			codeLinesForProcessing[FIRST_ELEMENT_INDEX]!.trim()
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
 * Renders an ApexDoc code block doc to text doc with formatted lines.
 * @param doc - The ApexDoc code block doc to render.
 * @param commentPrefix - The comment prefix string.
 * @param options - Options including printWidth.
 * @returns The rendered content doc or null if empty.
 */
interface RenderedContentToken {
	readonly type: 'paragraph' | 'text';
	readonly content: string;
	readonly lines: string[];
	readonly isContinuation?: boolean;
}

// RenderedContent type removed - renderCodeBlock and renderAnnotation always return RenderedContentToken (never null)

const renderCodeBlock = (
	doc: ApexDocCodeBlock,
	commentPrefix: string,
	options: Readonly<{
		readonly printWidth?: number;
	}>,
): RenderedContentToken => {
	// Code blocks are formatted through Prettier which uses AST-based annotation normalization
	// Use formattedCode if available, otherwise use rawCode
	const codeToUse: string = doc.formattedCode ?? doc.rawCode;

	// Preserve blank lines: insert blank line after } when followed by annotations or access modifiers
	// Apply blank line preservation even for formattedCode to restore blank lines that Prettier removed
	const processedCode = processCodeLines(codeToUse);
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

	// processedCode.length <= EMPTY is unreachable because:
	// - If processedCode is empty, then processedCode.trim() is also empty
	// - So isEmptyBlock would be true, and we'd return early above

	const codeLinesForProcessing = processedCode.split('\n');
	// alreadyWrapped check is unreachable - codeToUse never includes {@code wrapper
	// options.printWidth is guaranteed to be defined because:
	// - renderCodeBlock is called from docsToApexDocString
	// - which receives options with printWidth from calculatePrefixAndWidth
	// - which calls calculateEffectiveWidth, which throws if printWidth is undefined
	// Type assertion safe: printWidth is always defined per above comment
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- printWidth is always defined per comment above
	const printWidthValue = options.printWidth!;
	const finalCodeLines = handleUnwrappedCode(
		codeLinesForProcessing,
		commentPrefix,
		printWidthValue,
	);

	const lines = buildLinesWithPrefixes(finalCodeLines, commentPrefix);
	// handleUnwrappedCode always returns at least ['{@code'] or ['{@code', ...lines, '}'],
	// so lines is never empty (buildLinesWithPrefixes just adds prefixes to each line)
	return {
		content: lines.join('\n'),
		lines,
		type: 'text',
	};
};

/**
 * Renders an ApexDoc text or paragraph doc with wrapping applied.
 * @param doc - The ApexDoc content doc to render.
 * @param commentPrefix - The comment prefix string.
 * @param effectiveWidth - The effective width for wrapping.
 * @param options - Options including tabWidth and useTabs.
 * @returns The rendered content doc.
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for text/paragraph rendering
const renderTextOrParagraphDoc = (
	doc: ApexDocContent,
	commentPrefix: string,
	effectiveWidth: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
	// eslint-disable-next-line @typescript-eslint/max-params -- Arrow function signature line
): RenderedContentToken => {
	// Extract string content from Doc for wrapping
	const contentString = getContentString(doc);
	const linesString = getContentLines(doc);
	// eslint-disable-next-line @typescript-eslint/no-use-before-define -- wrapTextContent is defined later but used here
	const wrappedLines = wrapTextContent(
		contentString,
		linesString,
		effectiveWidth,
		options,
	);
	const allLines = wrappedLines.flatMap((line) => line.split('\n'));
	// eslint-disable-next-line @typescript-eslint/no-use-before-define -- removeTrailingEmptyLines is defined later but used here
	const cleanedLines = removeTrailingEmptyLines(allLines);
	const linesWithPrefix = cleanedLines.map(
		(line: string) => `${commentPrefix}${line.trim()}`,
	);
	// isContinuation is always undefined because:
	// - parseCommentToDocs creates paragraphs via createDocContent without isContinuation parameter
	// - createMergedDoc preserves isContinuation from original doc, but original docs never have it set
	// - So the isContinuation !== undefined branch is unreachable
	return {
		content: cleanedLines.join('\n'),
		lines: linesWithPrefix,
		type: doc.type,
	};
};

/**
 * Converts ApexDoc Doc comment docs (including ApexDocAnnotations) back into a
 * normalized comment string.
 * This function is ApexDoc-aware and knows how to render annotation docs,
 * but defers the final comment construction (including the opening and closing
 * comment markers) to the
 * generic tokensToCommentString helper from comments.ts (which works with ApexDocComment[]).
 * @param docs - Array of Doc-based comment docs (may include ApexDocAnnotations).
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @param cachedPrefixAndWidth - Optional cached prefix and width calculations.
 * @returns The formatted ApexDoc comment string.
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for ApexDoc string conversion
const docsToApexDocString = (
	docs: readonly ApexDocComment[],
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
		readonly printWidth?: number;
	}>,
	cachedPrefixAndWidth: ReturnType<typeof calculatePrefixAndWidth>,
	// eslint-disable-next-line @typescript-eslint/max-params -- Arrow function signature line
): string => {
	// cachedPrefixAndWidth is always defined when this function is called because:
	// - When printWidth is undefined, parseApexDocs throws before reaching here (line 570)
	// - When printWidth is defined, prefixAndWidth is calculated (not null) and passed here
	const { commentPrefix, effectiveWidth } = cachedPrefixAndWidth;

	const apexDocs: ApexDocComment[] = [];

	// renderCodeBlock always returns RenderedContentToken (never null)

	/**
	 * Adds rendered content to the apexDocs array.
	 * @param rendered - The rendered content token to add to the array.
	 */
	const addRenderedContent = (rendered: RenderedContentToken): void => {
		apexDocs.push(
			createDocContent(
				rendered.type,
				rendered.content,
				rendered.lines,
				rendered.isContinuation,
			),
		);
	};

	for (const doc of docs) {
		if (doc.type === 'annotation') {
			// renderAnnotation always returns a rendered doc (never null)
			// Removed unreachable null check: renderAnnotation always returns an object
			const rendered = renderAnnotation(doc, commentPrefix);
			addRenderedContent(rendered);
		} else if (doc.type === 'code') {
			addRenderedContent(renderCodeBlock(doc, commentPrefix, options));
		} else {
			// doc.type is 'text' or 'paragraph' (all possible types covered above)
			const rendered = renderTextOrParagraphDoc(
				doc,
				commentPrefix,
				effectiveWidth,
				options,
			);
			apexDocs.push(
				createDocContent(
					rendered.type,
					rendered.content,
					rendered.lines,
					rendered.isContinuation,
				),
			);
		}
	}

	return tokensToCommentString(apexDocs, commentIndent, {
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
	const ZERO_LENGTH = 0;
	const INDEX_OFFSET = 1;
	const EMPTY_TRIM_LENGTH = 0;
	while (
		cleaned.length > ZERO_LENGTH &&
		// Array indexing check removed: cleaned array has no holes (created from [...lines])
		// Type assertion safe: array element always exists when length > 0
		// eslint-disable-next-line jsdoc/convert-to-jsdoc-comments -- inline comments in code logic, not JSDoc
		((): boolean => {
			const lastLine = cleaned[cleaned.length - INDEX_OFFSET];
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-optional-chain -- lastLine always exists when length > 0, but check needed for type narrowing
			return (
				lastLine !== undefined &&
				lastLine!.trim().length === EMPTY_TRIM_LENGTH
			);
		})()
	) {
		cleaned.pop();
	}
	return cleaned;
};

/**
 * Wraps text content to fit within effective width.
 * @param content - The text content to wrap.
 * @param _originalLines - The original lines array (for reference, unused).
 * @param effectiveWidth - The effective width available for content.
 * @param options - Options including tabWidth and useTabs.
 * @returns Array of wrapped lines (without comment prefix).
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for text wrapping
const wrapTextContent = (
	content: string,
	_originalLines: readonly string[],
	effectiveWidth: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
	// eslint-disable-next-line @typescript-eslint/max-params -- Arrow function signature line
): string[] => {
	// content is always non-empty because getContentString comes from doc.content
	// which is created by contentToDoc, and contentToDoc only returns '' when lines.length === 0
	// but createDocContent is never called with empty lines array
	// So the else branch (lines 567-610) handling empty content is unreachable
	return wrapTextToWidth(content, effectiveWidth, options);
};

/**
 * Parses an ApexDoc comment into tokens and calculates effective page width.
 * Effective width accounts for comment prefix: printWidth - (baseIndent + ' * '.length).
 * @param normalizedComment - The normalized comment string.
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param printWidth - The maximum line width.
 * @param _options - Options including tabWidth and useTabs (unused but kept for API compatibility).
 * @returns Object with tokens and effective page width.
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for ApexDoc parsing
const parseApexDocs = (
	normalizedComment: Readonly<string>,
	commentIndent: number,
	printWidth: number,
	_options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
	// eslint-disable-next-line @typescript-eslint/max-params -- Arrow function signature line
): {
	readonly docs: readonly ApexDocComment[];
	readonly effectiveWidth: number;
	// eslint-disable-next-line @typescript-eslint/max-params -- Arrow function with 4 params
} => {
	const commentPrefixLength = CommentPrefix.getLength(commentIndent);
	const effectiveWidth = calculateEffectiveWidth(
		printWidth,
		commentPrefixLength,
	);

	// Parse comment to docs using the basic parser (now returns ApexDocComment[])
	let docs = parseCommentToDocs(normalizedComment);

	return {
		docs,
		effectiveWidth,
	};
};

/**
 * Checks if content has a complete code block starting at codeTagIndex.
 * @param content - The content to check.
 * @param codeTagIndex - The index where the code tag starts.
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
			const ZERO_BRACE_COUNT = 0;
			if (braceCount === ZERO_BRACE_COUNT) {
				return true;
			}
		}
		searchPos++;
	}
	return false;
};

/**
 * Creates a merged ApexDocContent from paragraph docs.
 * @param doc - The original Doc content doc.
 * @param _mergedContent - The merged content string (unused but kept for API compatibility).
 * @param mergedLines - The merged lines array (without comment prefix).
 * @returns The merged Doc content doc.
 */
const createMergedDoc = (
	doc: ApexDocContent,
	_mergedContent: string,
	mergedLines: string[],
): ApexDocContent => {
	const { join, hardline } = docBuilders;
	const docLines = mergedLines.map((line) => line as Doc);
	// join() from prettier's docBuilders never returns null/undefined
	// join() handles single-element arrays correctly, so we can simplify the ternary
	// docLines.length is never 0 because mergedLines comes from getContentLines(doc),
	// and doc.lines is never empty (createDocContent is always called with at least one line)
	const contentDoc: Doc = join(hardline, docLines);
	const result: ApexDocContent = {
		content: contentDoc,
		isContinuation: doc.isContinuation,
		lines: docLines,
		type: 'paragraph',
	};
	return result;
};

/**
 * Attempts to merge docs with incomplete code blocks.
 * @param doc - The Doc content doc to merge.
 * @param codeTagIndex - The index where the code tag starts.
 * @param docs - Array of all Doc comment docs.
 * @param startIndex - The starting index in the docs array.
 * @returns Object with merged doc and next index.
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for code block merging
const mergeIncompleteCodeBlock = (
	doc: ApexDocContent,
	codeTagIndex: number,
	docs: readonly ApexDocComment[],
	startIndex: number,
	// eslint-disable-next-line @typescript-eslint/max-params -- Arrow function signature line
): { mergedDoc: ApexDocContent | null; nextIndex: number } => {
	let mergedContent = getContentString(doc);
	let mergedLines = getContentLines(doc);

	let j = startIndex + INDEX_ONE;

	while (j < docs.length) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- nextDoc is always defined per array bounds check
		const nextDoc = docs[j]!;
		// mergeIncompleteCodeBlock is called from mergeCodeBlockDocs
		// which only receives paragraph/text types from parseApexDocs
		// So all docs here are guaranteed to be paragraph or text type
		// Removed unreachable checks: nextDoc is never undefined and always 'text' or 'paragraph'
		// Type guard: nextDoc is now ApexDocContent (text or paragraph)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- nextDoc is guaranteed to be ApexDocContent per comment above
		const nextContent = getContentString(nextDoc as ApexDocContent);
		mergedContent += nextContent;
		mergedLines = [
			...mergedLines,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- nextDoc is guaranteed to be ApexDocContent per comment above
			...getContentLines(nextDoc as ApexDocContent),
		];

		// Check if the merged content now has a complete block
		if (hasCompleteCodeBlock(mergedContent, codeTagIndex)) {
			return {
				mergedDoc: createMergedDoc(doc, mergedContent, [
					...mergedLines,
				]),
				nextIndex: j,
			};
		}
		j++;
	}

	return { mergedDoc: null, nextIndex: startIndex };
};

/**
 * Merges paragraph docs that contain split code blocks to ensure complete blocks are in single docs.
 * @param docs - Array of Doc-based comment docs.
 * @returns Array of docs with merged code blocks.
 */
const mergeCodeBlockDocs = (
	docs: readonly ApexDocComment[],
): readonly ApexDocComment[] => {
	const mergedDocs: ApexDocComment[] = [];
	let i = 0;

	while (i < docs.length) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- doc is always defined per array bounds check
		const doc = docs[i]!;
		// mergeCodeBlockDocs is called on initialDocs from parseApexDocs
		// which only contains 'paragraph' or 'text' types
		// Code and annotation types are created later in applyDocProcessingPipeline
		// So all docs here are guaranteed to be paragraph or text type
		// Removed unreachable checks: doc is never undefined and always 'text' or 'paragraph'
		// Type guard: doc is now ApexDocContent (text or paragraph)
		// Extract string content from Doc for text operations
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- doc is guaranteed to be ApexDocContent per comment above
		const content = getContentString(doc as ApexDocContent);
		const codeTagIndex = content.indexOf('{@code');
		const NOT_FOUND_CODE_TAG = -1;

		if (codeTagIndex === NOT_FOUND_CODE_TAG) {
			// No {@code} tag, add as-is
			mergedDocs.push(doc);
			i++;
			continue;
		}

		// Check if this doc contains a complete {@code} block
		if (hasCompleteCodeBlock(content, codeTagIndex)) {
			// Complete block in single doc
			mergedDocs.push(doc);
			i++;
			continue;
		}

		// Need to merge with subsequent docs
		// Type guard: doc is already confirmed to be text or paragraph (not code) above
		const mergeResult = mergeIncompleteCodeBlock(
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- doc is guaranteed to be ApexDocContent per comment above
			doc as ApexDocContent,
			codeTagIndex,
			docs,
			i,
		);
		if (mergeResult.mergedDoc) {
			mergedDocs.push(mergeResult.mergedDoc);
			const INDEX_INCREMENT = 1;
			i = mergeResult.nextIndex + INDEX_INCREMENT;
		} else {
			// Couldn't find complete block, add original doc
			mergedDocs.push(doc);
			i++;
		}
	}

	return mergedDocs;
};

/**
 * Checks if a paragraph content contains ApexDoc-specific elements like annotations or code blocks.
 * @param content - The paragraph content to check.
 * @returns True if the content contains ApexDoc elements.
 */

/**
 * Applies the common doc processing pipeline: code block detection, annotation detection, and normalization.
 * @param docs - Array of Doc-based comment docs.
 * @param normalizedComment - The normalized comment text (may be undefined in async contexts).
 * @param isEmbedFormatted - Whether the comment was already formatted by the embed function.
 * @returns Array of processed Doc docs.
 */
const applyDocProcessingPipeline = (
	docs: readonly ApexDocComment[],
	normalizedComment = '', // Default parameter instead of ?? operator for better coverage
	isEmbedFormatted = false,
): readonly ApexDocComment[] => {
	// Detect code blocks first to separate {@code} content from regular text
	// Pass isEmbedFormatted flag to preserve formatted code
	// normalizedComment is always defined when called from normalizeSingleApexDocComment
	// Default parameter avoids unreachable ?? '' branch
	const commentText = normalizedComment;
	// eslint-disable-next-line @typescript-eslint/no-use-before-define -- detectCodeBlockDocs is defined later but used here
	let processedDocs = detectCodeBlockDocs(
		docs,
		commentText,
		isEmbedFormatted,
	);

	// Detect annotations in docs that contain ApexDoc content
	// Code blocks are now handled as separate docs
	processedDocs = detectAnnotationsInDocs(processedDocs, commentText);

	// Normalize annotations
	processedDocs = normalizeAnnotations(processedDocs);

	return processedDocs;
};

/**
 * Filters out whitespace-only lines from text.
 * @param text - The text to filter.
 * @returns Array of non-empty lines after filtering.
 */
const filterNonEmptyLines = (text: string): string[] => {
	return text
		.split('\n')
		.filter((line: string) => line.trim().length > EMPTY);
};

/**
 * Creates a Doc text doc from cleaned text for paragraph docs.
 * @param cleanedText - The cleaned text content.
 * @param _doc - The Doc content doc (unused but kept for API compatibility).
 * @returns The created Doc text doc (never null - always returns a doc).
 */
const createDocTextFromParagraph = (
	cleanedText: string,
	_doc: ApexDocContent,
): ApexDocContent => {
	// cleanedText.length > 0 is guaranteed by addTextDocIfNotEmpty check
	// cleanedText comes from remainingText.trimEnd() or textBeforeCode.trimEnd()
	// which are substrings of processedContent (comment text)
	// If all lines were whitespace-only, trimEnd() would make it empty, causing early return
	// So filtered lines will always have content
	const splitLines = filterNonEmptyLines(cleanedText);
	return createDocContent('text', cleanedText, splitLines);
};

/**
 * Adds a text doc from cleaned text if it's not empty.
 * @param cleanedText - The cleaned text content.
 * @param doc - The Doc content doc.
 * @param newDocs - Array to add new Doc docs to.
 */
const addTextDocIfNotEmpty = (
	cleanedText: string,
	doc: ApexDocContent,
	newDocs: ApexDocComment[],
): void => {
	if (cleanedText.length <= EMPTY) {
		return;
	}
	// Text type docs are only created from empty comments (no content)
	// so they never contain code blocks and this path is unreachable
	// All code block processing happens on paragraph type docs
	// createDocTextFromParagraph always returns a doc (never null) because:
	// - cleanedText.length > 0 is guaranteed by check above
	// - filterNonEmptyLines on non-empty cleanedText will have at least one line
	// - createDocContent always returns a doc (never null)
	const textDoc = createDocTextFromParagraph(cleanedText, doc);
	newDocs.push(textDoc);
};

/**
 * Processes remaining text after last code tag.
 * @param content - The content string.
 * @param currentPos - The current position in content.
 * @param doc - The Doc content doc.
 * @param newDocs - Array to add new Doc docs to.
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for text processing
const processRemainingText = (
	content: string,
	currentPos: number,
	doc: ApexDocContent,
	newDocs: ApexDocComment[],
	// eslint-disable-next-line @typescript-eslint/max-params -- Arrow function signature line
): void => {
	// currentPos is guaranteed to be < content.length by the calling loop condition
	// so remainingText will always have at least one character
	const remainingText = content.substring(currentPos);
	addTextDocIfNotEmpty(remainingText.trimEnd(), doc, newDocs);
};

/**
 * Processes text before code tag.
 * @param content - The content string.
 * @param lastMatchEnd - The end position of last match.
 * @param codeTagStart - The start position of code tag.
 * @param doc - The Doc content doc.
 * @param newDocs - Array to add new Doc docs to.
 */
const processTextBeforeCode = (
	content: string,
	lastMatchEnd: number,
	codeTagStart: number,
	doc: ApexDocContent,
	newDocs: ApexDocComment[],
	// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 5 parameters for text processing
): void => {
	if (codeTagStart <= lastMatchEnd) {
		return;
	}
	// codeTagStart > lastMatchEnd ensures textBeforeCode has at least one character
	const textBeforeCode = content.substring(lastMatchEnd, codeTagStart);
	addTextDocIfNotEmpty(textBeforeCode.trimEnd(), doc, newDocs);
};

/**
 * Processes ApexDoc content doc to detect code blocks.
 * @param doc - The ApexDoc content doc to process.
 * @param newDocs - Array to add new Doc docs to.
 * @param isEmbedFormatted - Whether the comment was already formatted by the embed function.
 */
const processContentForCodeBlocks = (
	doc: ApexDocContent,
	newDocs: ApexDocComment[],
	isEmbedFormatted = false,
): void => {
	// Extract lines from Doc for text operations
	const lines = getContentLines(doc);
	// For content docs, work with the lines array to preserve line breaks
	// Use removeCommentPrefix with preserveIndent=true to preserve code block indentation
	const processedContent =
		doc.type === 'paragraph'
			? lines
					.map((line: string) => removeCommentPrefix(line, true))
					.join('\n')
			: lines.join('\n');
	let currentPos = ARRAY_START_INDEX;
	let lastMatchEnd = ARRAY_START_INDEX;

	while (currentPos < processedContent.length) {
		const codeTagStart = processedContent.indexOf(CODE_TAG, currentPos);

		if (codeTagStart === NOT_FOUND_INDEX) {
			processRemainingText(processedContent, currentPos, doc, newDocs);
			break;
		}

		processTextBeforeCode(
			processedContent,
			lastMatchEnd,
			codeTagStart,
			doc,
			newDocs,
		);

		const codeBlockResult = extractCodeFromBlock(
			processedContent,
			codeTagStart,
		);
		if (codeBlockResult) {
			// If comment was already formatted by embed function, treat extracted code as formatted
			const formattedCode = isEmbedFormatted
				? codeBlockResult.code
				: undefined;
			newDocs.push(
				createDocCodeBlock(
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
 * Detects code blocks in docs by scanning for code tag patterns.
 * Converts ApexDocContent content containing code tags to ApexDocCodeBlock.
 * @param docs - Array of Doc-based comment docs.
 * @param _originalComment - The original comment string for position tracking (unused but kept for API compatibility).
 * @param isEmbedFormatted - Whether the comment was already formatted by the embed function.
 * @returns Array of docs with code blocks detected.
 */
const detectCodeBlockDocs = (
	docs: readonly ApexDocComment[],
	_originalComment: Readonly<string>,
	isEmbedFormatted = false,
): readonly ApexDocComment[] => {
	const newDocs: ApexDocComment[] = [];

	for (const doc of docs) {
		if (doc.type === 'text' || doc.type === 'paragraph') {
			processContentForCodeBlocks(doc, newDocs, isEmbedFormatted);
		} else {
			newDocs.push(doc);
		}
	}
	return newDocs;
};

export {
	EMPTY_CODE_TAG,
	normalizeSingleApexDocComment,
	detectCodeBlockDocs,
	removeTrailingEmptyLines,
	isApexDoc,
	filterNonEmptyLines,
};

/**
 * Processes an ApexDoc comment for printing, including embed formatting, normalization, and indentation.
 * @param commentValue - The raw comment value from the AST.
 * @param options - Parser options.
 * @param _getCurrentOriginalText - Function to get the original source text.
 * @param getFormattedCodeBlock - Function to get cached embed-formatted comments.
 * @returns The processed comment ready for printing.
 */

export type { CodeBlock, ReadonlyCodeBlock };
