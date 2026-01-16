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
	isNotEmpty,
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
const normalizeSingleApexDocComment = (
	commentValue: Readonly<string>,
	commentIndent: number,
	options: Readonly<ParserOptions>,
	isEmbedFormatted = false,
): Doc => {
	const { printWidth, tabWidth } = options;
	const tabWidthValue = tabWidth;

	// Basic structure normalization - {@code} blocks are handled by the embed system
	let normalizedComment = normalizeBlockComment(commentValue, commentIndent, {
		tabWidth: tabWidthValue,
		useTabs: options.useTabs,
	});

	// Parse to docs
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
	let docs = mergeCodeBlockDocs(initialDocs);

	// Apply common doc processing pipeline
	// Pass isEmbedFormatted flag to preserve formatted code from embed function
	docs = applyDocProcessingPipeline(
		docs,
		normalizedComment,
		isEmbedFormatted,
	);

	// Cache prefix and width calculations (used in both wrapAnnotations and docsToApexDocString)
	const prefixAndWidth = printWidth
		? calculatePrefixAndWidth(commentIndent, printWidth, {
				tabWidth: tabWidthValue,
				useTabs: options.useTabs,
			})
		: null;

	// Wrap annotations if printWidth is available
	if (prefixAndWidth) {
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
	}

	// Convert docs back to string
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
 * @param shouldTrim - Whether to trim the entire string before splitting (preserves indentation if false).
 * @returns Processed code with blank lines preserved.
 */
const processCodeLines = (
	codeToUse: string,
	shouldTrim = true,
): string => {
	const codeLines = shouldTrim
		? codeToUse.trim().split('\n')
		: codeToUse.split('\n');
	const resultLines: string[] = [];

	for (let i = ARRAY_START_INDEX; i < codeLines.length; i++) {
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
	if (codeLinesForProcessing.length === INDEX_ONE) {
		const [line] = codeLinesForProcessing;
		if (line !== undefined && line.includes(';') && line.endsWith('}')) {
			 
			codeLinesForProcessing[ARRAY_START_INDEX] =
				line.slice(0, -1) + ' }';
		}
	}
	return codeLinesForProcessing;
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
	const singleLineContent = isSingleLine
		? (codeLinesForProcessing[ARRAY_START_INDEX]?.trim() ?? '')
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

type RenderedContent = RenderedContentToken | null;

const renderCodeBlock = (
	doc: ApexDocCodeBlock,
	commentPrefix: string,
	options: Readonly<{
		readonly printWidth?: number;
	}>,
): RenderedContent => {
	// Code blocks are formatted through Prettier which uses AST-based annotation normalization
	// Use formattedCode if available, otherwise use rawCode
	const codeToUse = doc.formattedCode ?? doc.rawCode;

	// Preserve blank lines: insert blank line after } when followed by annotations or access modifiers
	// Apply blank line preservation even for formattedCode to restore blank lines that Prettier removed
	const processedCode = processCodeLines(codeToUse, true);
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
						'prettier-plugin-apex-imo: options.printWidth is required for renderCodeBlock',
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
 * Renders an ApexDoc text or paragraph doc with wrapping applied.
 * @param doc - The ApexDoc content doc to render.
 * @param commentPrefix - The comment prefix string.
 * @param effectiveWidth - The effective width for wrapping.
 * @param options - Options including tabWidth and useTabs.
 * @returns The rendered content doc.
 */
const renderTextOrParagraphDoc = (
	doc: ApexDocContent,
	commentPrefix: string,
	effectiveWidth: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): RenderedContentToken => {
	// Extract string content from Doc for wrapping
	const contentString = getContentString(doc);
	const linesString = getContentLines(doc);
	const wrappedLines = wrapTextContent(
		contentString,
		linesString,
		effectiveWidth,
		options,
	);
	const allLines = wrappedLines.flatMap((line) => line.split('\n'));
	const cleanedLines = removeTrailingEmptyLines(allLines);
	const linesWithPrefix = cleanedLines.map(
		(line: string) => `${commentPrefix}${line.trim()}`,
	);
	const baseResult = {
		content: cleanedLines.join('\n'),
		lines: linesWithPrefix,
		type: doc.type,
	} as const;
	if (doc.isContinuation !== undefined) {
		return {
			...baseResult,
			isContinuation: doc.isContinuation,
		};
	}
	return baseResult;
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
const docsToApexDocString = (
	docs: readonly ApexDocComment[],
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
		readonly printWidth?: number;
	}>,
	cachedPrefixAndWidth?: ReturnType<typeof calculatePrefixAndWidth> | null,
): string => {
	const prefixAndWidth =
		cachedPrefixAndWidth ??
		calculatePrefixAndWidth(commentIndent, options.printWidth, options);
	const { commentPrefix, effectiveWidth } = prefixAndWidth;

	const apexDocs: ApexDocComment[] = [];

	const addRenderedContent = (rendered: RenderedContent): void => {
		if (rendered) {
			apexDocs.push(
				createDocContent(
					rendered.type,
					rendered.content,
					rendered.lines,
					rendered.isContinuation,
				),
			);
		}
	};

	for (const doc of docs) {
		if (doc.type === 'annotation') {
			addRenderedContent(renderAnnotation(doc, commentPrefix));
		} else if (doc.type === 'code') {
			addRenderedContent(renderCodeBlock(doc, commentPrefix, options));
		} else if (doc.type === 'text' || doc.type === 'paragraph') {
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
		} else {
			apexDocs.push(doc);
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
				? (cleanedLines[i + INDEX_ONE]?.trim() ?? '')
				: '';

		// Check if we should join with next line
		const currentEndsWithPeriod = currentLine.endsWith('.');
		// Use character comparison instead of regex to check if line starts with capital letter
		const nextStartsWithCapital =
			nextLine.length > EMPTY &&
			nextLine[0] !== undefined &&
			nextLine[0] >= 'A' &&
			nextLine[0] <= 'Z';
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
 * Effective width accounts for comment prefix: printWidth - (baseIndent + ' * '.length).
 * @param normalizedComment - The normalized comment string.
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param printWidth - The maximum line width.
 * @param options - Options including tabWidth and useTabs.
 * @param _options
 * @returns Object with tokens and effective page width.
 */
const parseApexDocs = (
	normalizedComment: Readonly<string>,
	commentIndent: number,
	printWidth: number,
	_options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): {
	readonly docs: readonly ApexDocComment[];
	readonly effectiveWidth: number;
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
 * Creates a merged ApexDocContent from paragraph docs.
 * @param doc - The original Doc content doc.
 * @param mergedContent - The merged content string.
 * @param _mergedContent
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
	const contentDoc: Doc =
		docLines.length === 0
			? ('' as Doc)
			: docLines.length === 1
				? docLines[0] ?? ('' as Doc)
				: join(hardline, docLines) ?? ('' as Doc);
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
const mergeIncompleteCodeBlock = (
	doc: ApexDocContent,
	codeTagIndex: number,
	docs: readonly ApexDocComment[],
	startIndex: number,
): { mergedDoc: ApexDocContent | null; nextIndex: number } => {
	let mergedContent = getContentString(doc);
	let mergedLines = getContentLines(doc);
	 
	let j = startIndex + INDEX_ONE;

	while (j < docs.length) {
		const nextDoc = docs[j];
		if (
			!nextDoc ||
			(nextDoc.type !== 'paragraph' && nextDoc.type !== 'text')
		) {
			// Non-content doc or missing doc, stop merging
			j++;
			continue;
		}

		const nextContent = getContentString(nextDoc);
		mergedContent += nextContent;
		mergedLines = [...mergedLines, ...getContentLines(nextDoc)];

		// Check if the merged content now has a complete block
		if (hasCompleteCodeBlock(mergedContent, codeTagIndex)) {
			return {
				mergedDoc: createMergedDoc(doc, mergedContent, [...mergedLines]),
				nextIndex: j,
			};
		}
		j++;
	}

	return { mergedDoc: null, nextIndex: startIndex };
};

/**
 * Merges paragraph docs that contain split {@code} blocks to ensure complete blocks are in single docs.
 * @param docs - Array of Doc-based comment docs.
 * @returns Array of docs with merged {@code} blocks.
 */
const mergeCodeBlockDocs = (
	docs: readonly ApexDocComment[],
): readonly ApexDocComment[] => {
	const mergedDocs: ApexDocComment[] = [];
	let i = 0;

	while (i < docs.length) {
		const doc = docs[i];
		if (!doc) {
			i++;
			continue;
		}

		if (doc.type !== 'paragraph' && doc.type !== 'text') {
			// Non-content doc, add as-is
			mergedDocs.push(doc);
			i++;
			continue;
		}

		// Extract string content from Doc for text operations
		const content = getContentString(doc);
		const codeTagIndex = content.indexOf('{@code');

		if (codeTagIndex === -1) {
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
		const mergeResult = mergeIncompleteCodeBlock(
			doc,
			codeTagIndex,
			docs,
			i,
		);
		if (mergeResult.mergedDoc) {
			mergedDocs.push(mergeResult.mergedDoc);
			i = mergeResult.nextIndex + 1;
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
	normalizedComment?: string,
	isEmbedFormatted = false,
): readonly ApexDocComment[] => {
	// Detect code blocks first to separate {@code} content from regular text
	// Pass isEmbedFormatted flag to preserve formatted code
	let processedDocs = detectCodeBlockDocs(
		docs,
		normalizedComment !== undefined ? normalizedComment : '',
		isEmbedFormatted,
	);

	// Detect annotations in docs that contain ApexDoc content
	// Code blocks are now handled as separate docs
	processedDocs = detectAnnotationsInDocs(
		processedDocs,
		normalizedComment !== undefined ? normalizedComment : '',
	);

	// Normalize annotations
	processedDocs = normalizeAnnotations(processedDocs);

	return processedDocs;
};

/**
 * Creates a Doc text doc from cleaned text for paragraph docs.
 * @param cleanedText - The cleaned text content.
 * @param doc - The Doc content doc.
 * @param _doc
 * @returns The created Doc text doc or null if empty.
 */
const createDocTextFromParagraph = (
	cleanedText: string,
	_doc: ApexDocContent,
): ApexDocContent | null => {
	const splitLines = cleanedText
		.split('\n')
		.filter((line: string) => line.trim().length > EMPTY);
	if (splitLines.length === EMPTY) {
		return null;
	}
	return createDocContent('text', cleanedText, splitLines);
};

/**
 * Creates a Doc text doc from cleaned text for text docs.
 * @param cleanedText - The cleaned text content.
 * @returns The created Doc text doc or null if empty.
 */
const createDocTextFromText = (cleanedText: string): ApexDocContent | null => {
	const splitLines = cleanedText.split('\n');
	const cleanedLines = removeTrailingEmptyLines(splitLines);
	if (cleanedLines.length === EMPTY) {
		return null;
	}
	return createDocContent('text', cleanedText, cleanedLines);
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
	const textDoc =
		doc.type === 'paragraph'
			? createDocTextFromParagraph(cleanedText, doc)
			: createDocTextFromText(cleanedText);
	if (textDoc) {
		newDocs.push(textDoc);
	}
};

/**
 * Processes remaining text after last code tag.
 * @param content - The content string.
 * @param currentPos - The current position in content.
 * @param doc - The Doc content doc.
 * @param newDocs - Array to add new Doc docs to.
 */
const processRemainingText = (
	content: string,
	currentPos: number,
	doc: ApexDocContent,
	newDocs: ApexDocComment[],
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
 * Detects code blocks in docs by scanning for {@code} patterns.
 * Converts ApexDocContent content containing {@code} to ApexDocCodeBlock.
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
