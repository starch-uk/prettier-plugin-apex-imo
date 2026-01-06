/**
 * @file Functions for finding and formatting ApexDoc code blocks within comments.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import type { ParserOptions } from 'prettier';
import {
	createIndent,
	normalizeBlockComment,
	ARRAY_START_INDEX,
	INDEX_ONE,
	INDEX_TWO,
	EMPTY,
} from './comments.js';
import {
	APEXDOC_ANNOTATIONS,
	APEXDOC_GROUP_NAMES,
} from './refs/apexdoc-annotations.js';

const FORMAT_FAILED_PREFIX = '__FORMAT_FAILED__';
const EMPTY_CODE_TAG = '{@code}';
const INITIAL_BRACE_COUNT = 1;
const NOT_FOUND_INDEX = -1;
const INDEX_THREE = 3;
const INDEX_FOUR = 4;
const MAX_ANNOTATION_LINE_LENGTH = 20;
const PARSE_INT_RADIX = 10;
const SLICE_END_OFFSET = -1;
const DEFAULT_BRACE_COUNT = 1;
const ZERO_BRACE_COUNT = 0;

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

	// First, apply basic block comment normalization (markers, asterisks, indentation)
	// This normalizes the structure, but code block content indentation will be preserved
	// by the embed function and then by ApexDoc-specific code below
	let normalizedComment = normalizeBlockComment(commentValue, commentIndent, {
		tabWidth: tabWidthValue,
		useTabs: options.useTabs,
	});

	// Cache repeated calculations
	const baseIndent = createIndent(
		commentIndent,
		tabWidthValue,
		options.useTabs,
	);
	const commentPrefix = `${baseIndent} * `;

	// Now apply ApexDoc-specific normalization
	// Track code block indentation using a stack for proper nesting support
	// Each entry stores the detected indentation string for that code block level
	// The indentation is detected from the embed function's output (respects tabWidth/useTabs)
	const originalLines = commentValue.split('\n');
	const lines = normalizedComment.split('\n');
	const normalizedLines: string[] = [];
	// Stack to track accumulating indentation for code blocks
	// Each entry stores the indentation string for that code block level
	const codeBlockIndentStackEarly: string[] = [];
	let inCodeBlockEarly = false;
	for (let i = ARRAY_START_INDEX; i < lines.length; i++) {
		const line = lines[i] ?? '';
		const originalLine = originalLines[i] ?? '';
		// Skip the first line (/**) and last line (*/)
		if (i === ARRAY_START_INDEX || i === lines.length - INDEX_ONE) {
			normalizedLines.push(line);
			continue;
		}
		// Track code block boundaries using brace counting for proper nesting support
		const normalizedLineForCodeBlock = line.replace(
			/^(\s*)\*+(\s*)/,
			'$1*$2',
		);
		const trimmedLineForCodeBlockEarly = normalizedLineForCodeBlock
			.replace(/^\s*\*\s*/, '')
			.trim();
		if (line.includes('{@code')) {
			inCodeBlockEarly = true;
			// Push empty string - will detect indentation from first continuation line
			codeBlockIndentStackEarly.push('');
			// Count opening brace in {@code tag
			let codeBlockBraceCount = INITIAL_BRACE_COUNT;
			// Count braces in the rest of the line
			const codeTagIndex = trimmedLineForCodeBlockEarly.indexOf('{@code');
			for (const char of trimmedLineForCodeBlockEarly.substring(
				codeTagIndex + '{@code'.length,
			)) {
				if (char === '{') {
					codeBlockBraceCount++;
				} else if (char === '}') {
					codeBlockBraceCount--;
				}
			}
			// Store brace count in the stack entry (as a string representation)
			codeBlockIndentStackEarly[
				codeBlockIndentStackEarly.length - INDEX_ONE
			] = String(codeBlockBraceCount);
		}
		if (inCodeBlockEarly) {
			// Get current brace count from stack
			const currentBraceCount = Number.parseInt(
				codeBlockIndentStackEarly[
					codeBlockIndentStackEarly.length - INDEX_ONE
				] ?? String(DEFAULT_BRACE_COUNT),
				PARSE_INT_RADIX,
			);
			let newBraceCount = currentBraceCount;
			// Count braces in this line
			for (const char of trimmedLineForCodeBlockEarly) {
				if (char === '{') {
					newBraceCount++;
				} else if (char === '}') {
					newBraceCount--;
				}
			}
			// Update brace count in stack
			codeBlockIndentStackEarly[
				codeBlockIndentStackEarly.length - INDEX_ONE
			] = String(newBraceCount);
			// Code block ends when brace count reaches 0
			if (newBraceCount === ZERO_BRACE_COUNT) {
				inCodeBlockEarly = false;
				codeBlockIndentStackEarly.pop();
			}
		}
		// For code block content lines, preserve EXACTLY as formatted by embed function
		// The embed function has already added the correct prefix (e.g., "   * ") and preserved indentation
		// We must NOT reconstruct or modify these lines - just use the original line as-is
		if (inCodeBlockEarly && !line.includes('{@code')) {
			// Code block content line - preserve exactly as formatted by embed function
			// The originalLine already has the correct format: "   * " + embed indentation + content
			normalizedLines.push(originalLine);
		} else {
			// Normal line - keep as-is (already normalized by normalizeBlockComment)
			normalizedLines.push(line);
		}
	}
	normalizedComment = normalizedLines.join('\n');

	// Normalize annotation names (e.g., @Param -> @param) and split multiple annotations on same line
	// First, split lines with multiple annotations onto separate lines
	// Track code blocks to skip annotation splitting for code block content
	let inCodeBlockForSplit = false;
	let codeBlockBraceCountForSplit = 0;
	const annotationSplitLines = normalizedComment.split('\n');
	const splitLines: string[] = [];
	for (const line of annotationSplitLines) {
		// Track code block boundaries
		if (line.includes('{@code')) {
			inCodeBlockForSplit = true;
			codeBlockBraceCountForSplit = DEFAULT_BRACE_COUNT; // Count the opening brace in {@code
			// Count additional braces in the line
			const afterCodeTag = line.substring(line.indexOf('{@code') + '{@code'.length);
			for (const char of afterCodeTag) {
				if (char === '{') codeBlockBraceCountForSplit++;
				if (char === '}') codeBlockBraceCountForSplit--;
			}
		}
		if (inCodeBlockForSplit) {
			// Count braces in this line
			for (const char of line) {
				if (char === '{') codeBlockBraceCountForSplit++;
				if (char === '}') codeBlockBraceCountForSplit--;
			}
			// Code block ends when brace count reaches 0
			if (codeBlockBraceCountForSplit === ZERO_BRACE_COUNT) {
				inCodeBlockForSplit = false;
			}
			// Skip annotation splitting for code block content lines (but not the {@code line itself)
			// Preserve code block content exactly as-is
			if (!line.includes('{@code')) {
				splitLines.push(line);
				continue;
			}
		}
		// Match all annotations on the line: * @annotation1 value1 @annotation2 value2
		// Also match annotations that appear after text (e.g., "text. * @param" or "text * @param")
		const annotationMatches = [
			...line.matchAll(
				/(\s*\*\s*|\s+(?!\{)|\s*\*\s*\.\s*\*\s*)@([a-zA-Z_][a-zA-Z0-9_]*)(\s+[^\n@]*?)(?=\s*@|\s*\*|\s*$)/g,
			),
		];
		if (annotationMatches.length > INDEX_ONE) {
			// Multiple annotations on same line - split them
			// Ensure consistent indentation using baseIndent
			const consistentPrefix = commentPrefix;
			for (const match of annotationMatches) {
				const annotationName = match[INDEX_TWO] ?? '';
				const content = (match[INDEX_THREE] ?? '').trim();
				const lowerName = annotationName.toLowerCase();
				if (APEXDOC_ANNOTATIONS.includes(lowerName as never)) {
					splitLines.push(
						content.length > EMPTY
							? `${consistentPrefix}@${lowerName} ${content}`
							: `${consistentPrefix}@${lowerName}`,
					);
				} else {
					// For non-ApexDoc annotations, preserve original but normalize indentation
					const originalLine = match[ARRAY_START_INDEX];
					const linePrefixMatch = /^(\s*\*\s*)/.exec(originalLine);
					if (linePrefixMatch) {
						const restOfLine = originalLine
							.substring(
								linePrefixMatch[ARRAY_START_INDEX].length,
							)
							.trimStart();
						splitLines.push(`${consistentPrefix}${restOfLine}`);
					} else {
						splitLines.push(originalLine);
					}
				}
			}
		} else if (annotationMatches.length === INDEX_ONE) {
			// Single annotation on line - check if there's text before it
			const [match] = annotationMatches;
			if (!match) {
				splitLines.push(line);
				continue;
			}
			const annotationStart = match.index;
			// Check if there's non-whitespace text before the annotation
			const beforeAnnotation = line.substring(
				ARRAY_START_INDEX,
				annotationStart,
			);
			const textAfterAsterisk = beforeAnnotation
				.replace(/^\s*\*\s*/, '')
				.trim();
			const hasTextBefore = textAfterAsterisk.length > EMPTY;
			if (hasTextBefore) {
				// Split: text line + annotation line
				const consistentPrefix = commentPrefix;
				// Extract text before annotation - preserve the comment structure
				// Find the asterisk position to preserve indentation
				const asteriskMatch = /^(\s*)(\*)(\s*)/.exec(beforeAnnotation);
				if (asteriskMatch) {
					// Preserve the original indentation and asterisk, just add the text
					const asterisk = asteriskMatch[INDEX_TWO] ?? '';
					const textLine = `${baseIndent}${asterisk} ${textAfterAsterisk}`;
					splitLines.push(textLine);
				} else {
					// No asterisk found, use consistent prefix
					splitLines.push(`${consistentPrefix}${textAfterAsterisk}`);
				}
				// Extract annotation - handle case where prefix includes period
				const annotationName = match[INDEX_TWO] ?? '';
				const content = (match[INDEX_THREE] ?? '').trim();
				const lowerName = annotationName.toLowerCase();
				if (APEXDOC_ANNOTATIONS.includes(lowerName as never)) {
					const annotationLine =
						content.length > EMPTY
							? `${consistentPrefix}@${lowerName} ${content}`
							: `${consistentPrefix}@${lowerName}`;
					splitLines.push(annotationLine);
				} else {
					// For non-ApexDoc annotations, preserve original but remove period prefix if present
					const annotationPart = line.substring(annotationStart);
					const cleanedAnnotation = annotationPart
						.replace(/^\.\s*\*\s*/, '* ')
						.trimStart();
					splitLines.push(cleanedAnnotation);
				}
			} else {
				splitLines.push(line);
			}
		} else {
			splitLines.push(line);
		}
	}
	normalizedComment = splitLines.join('\n');

	// Normalize annotation names (e.g., @Param -> @param)
	// Match @ followed by annotation name, either at start of line (after optional whitespace and *)
	// or in the middle of a line (after whitespace, but not {)
	// Also handle cases where @ appears directly after * without space
	// CRITICAL: Skip annotations inside code blocks - they should use normal annotation normalization
	// (PascalCase) not ApexDoc normalization (lowercase)
	const annotationRegex =
		/(\s*\*\s*|\s*\*|\s+(?!\{))@([a-zA-Z_][a-zA-Z0-9_]*)(\s|$)/g;
	const consistentPrefixForNormalize = commentPrefix;
	// Process line-by-line to track code blocks and skip annotation normalization inside them
	// CRITICAL: Annotations inside code blocks are already normalized by the embed function
	// (using normal annotation normalization to PascalCase), so we must skip them here
	const linesForNormalize = normalizedComment.split('\n');
	const codeBlockIndentStackForNormalize: string[] = [];
	const annotationNormalizedLinesForRegex: string[] = [];
	for (let i = ARRAY_START_INDEX; i < linesForNormalize.length; i++) {
		const line = linesForNormalize[i] ?? '';
		const trimmedLine = line.replace(/^\s*\*\s*/, '').trim();

		// Track code block boundaries using brace counting
		if (trimmedLine.includes('{@code')) {
			codeBlockIndentStackForNormalize.push('');
			let codeBlockBraceCount = INITIAL_BRACE_COUNT;
			for (const char of trimmedLine.substring(
				trimmedLine.indexOf('{@code') + '{@code'.length,
			)) {
				if (char === '{') codeBlockBraceCount++;
				if (char === '}') codeBlockBraceCount--;
			}
			codeBlockIndentStackForNormalize[
				codeBlockIndentStackForNormalize.length - INDEX_ONE
			] = String(codeBlockBraceCount);
		}

		const inCodeBlock =
			codeBlockIndentStackForNormalize.length > ARRAY_START_INDEX;

		if (inCodeBlock) {
			const currentBraceCount = Number.parseInt(
				codeBlockIndentStackForNormalize[
					codeBlockIndentStackForNormalize.length - INDEX_ONE
				] ?? String(DEFAULT_BRACE_COUNT),
				PARSE_INT_RADIX,
			);
			let newBraceCount = currentBraceCount;
			for (const char of trimmedLine) {
				if (char === '{') {
					newBraceCount++;
				} else if (char === '}') {
					newBraceCount--;
				}
			}
			codeBlockIndentStackForNormalize[
				codeBlockIndentStackForNormalize.length - INDEX_ONE
			] = String(newBraceCount);
			if (newBraceCount === ZERO_BRACE_COUNT) {
				codeBlockIndentStackForNormalize.pop();
			}
		}

		// Only normalize annotations if NOT inside a code block
		// Annotations inside code blocks should use normal annotation normalization (PascalCase)
		// which is already applied by the embed function
		if (inCodeBlock) {
			annotationNormalizedLinesForRegex.push(line);
		} else {
			// eslint-disable-next-line jsdoc/convert-to-jsdoc-comments -- Regular inline comment, not JSDoc
			// Apply annotation normalization regex to this line
			const normalizeAnnotationMatch = (
				match: string,
				prefix: string,
				annotationName: string,
				suffix: string,
			) /* eslint-disable-line @typescript-eslint/max-params -- Regex replace callback requires 4 parameters */ : string => {
				const lowerName = annotationName.toLowerCase();
				// Check if it's a valid ApexDoc annotation
				if (APEXDOC_ANNOTATIONS.includes(lowerName as never)) {
					// Preserve newline from original prefix if present, otherwise use consistent prefix
					const normalizedPrefix = prefix.includes('\n')
						? `\n${consistentPrefixForNormalize}`
						: consistentPrefixForNormalize;
					return `${normalizedPrefix}@${lowerName}${suffix}`;
				}
				return match;
			};
			const normalizedLine = line.replace(
				annotationRegex,
				normalizeAnnotationMatch,
			);
			annotationNormalizedLinesForRegex.push(normalizedLine);
		}
	}
	normalizedComment = annotationNormalizedLinesForRegex.join('\n');
	
	// Normalize extra whitespace around annotations (e.g., "  @author   Developer  " -> "@author Developer")
	// Match lines with annotations and normalize spacing and indentation
	const annotationLines = normalizedComment.split('\n');
	const consistentPrefixForSpacing = commentPrefix;
	// Use a stack to track code block nesting levels and their indentation
	// Each entry stores the detected indentation string for that code block level
	// The indentation is detected from the embed function's output (respects tabWidth/useTabs)
	const codeBlockIndentStack: string[] = [];
	const annotationNormalizedLines = annotationLines.map((line, lineIndex) => {
		// Skip first and last lines (/** and */)
		if (
			lineIndex === ARRAY_START_INDEX ||
			lineIndex === annotationLines.length - INDEX_ONE
		) {
			// Normalize comment end if it has extra asterisks
			if (
				lineIndex === annotationLines.length - INDEX_ONE &&
				line.includes('**/')
			) {
				return line.replace(/\*{2,}\//, '*/');
			}
			return line;
		}
		// Track code block boundaries using stack
		const isCodeBlockStart = line.includes('{@code');
		// Update stack based on code block boundaries
		if (isCodeBlockStart) {
			// Push empty string - will detect indentation from first continuation line
			codeBlockIndentStack.push('');
		}
		// Don't pop here - code block ends are handled in the wrapping phase
		const inCodeBlock = codeBlockIndentStack.length > ARRAY_START_INDEX;
		// For code block content lines, preserve spacing after asterisk (don't normalize)
		// The embed function produces code with configurable indentation (tabWidth/useTabs)
		// ALL lines inside code blocks (except {@code} start) should be preserved
		if (inCodeBlock && !isCodeBlockStart) {
			// Inside code block - preserve the line structure, just normalize base indent and asterisks
			let normalizedLine = line;
			const asteriskMatch = /^(\s*)(\*+)(\s*)(.*)$/.exec(line);
			const asteriskMatchValue = asteriskMatch?.[ARRAY_START_INDEX];
			// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- asteriskMatchValue is string | undefined from regex exec
			if (asteriskMatchValue) {
				// Normalize multiple asterisks to single asterisk, but preserve spacing after asterisk
				const afterAsterisk = asteriskMatch[INDEX_THREE] ?? '';
				const content = asteriskMatch[INDEX_FOUR] ?? '';
				// Preserve the indentation from afterAsterisk (embed function preserves relative indentation)
				// consistentPrefixForSpacing is "   * " (includes 1 space after asterisk)
				// afterAsterisk already contains the correct indentation (1 space + additional if any)
				// Remove trailing space from consistentPrefixForSpacing and add afterAsterisk (which includes the space + indentation)
				const basePrefix = consistentPrefixForSpacing.slice(ARRAY_START_INDEX, SLICE_END_OFFSET); // "   *" (without trailing space)
				normalizedLine = `${basePrefix}${afterAsterisk}${content}`;
			} else {
				// Line has no asterisk - add one with preserved spacing
				const trimmed = line.trimStart();
				if (trimmed.startsWith('*')) {
					const afterAsteriskMatch = /^(\s*)/.exec(
						trimmed.substring(INDEX_ONE),
					);
					const afterAsterisk =
						afterAsteriskMatch?.[INDEX_ONE] ?? ' ';
					const restContent = trimmed
						.substring(INDEX_ONE)
						.trimStart();
					normalizedLine = `${consistentPrefixForSpacing.slice(ARRAY_START_INDEX, NOT_FOUND_INDEX)}${afterAsterisk}${restContent}`;
				} else {
					normalizedLine = `${consistentPrefixForSpacing}${trimmed}`;
				}
			}
			return normalizedLine;
		}
		// First, ensure the line has normalized asterisks (in case normalization at lines 513-574 didn't catch it)
		// This is a safety check to ensure all lines are normalized
		let normalizedLine = line;
		const asteriskMatch = /^(\s*)(\*+)(\s*)/.exec(line);
		const asteriskMatchValue = asteriskMatch?.[ARRAY_START_INDEX];
		// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- asteriskMatchValue is string | undefined from regex exec
		if (asteriskMatchValue) {
			// Normalize multiple asterisks to single asterisk
			let restOfLine = line.substring(
				asteriskMatch[ARRAY_START_INDEX].length,
			);
			restOfLine = restOfLine.replace(/^\s*\*+\s*/, '');
			normalizedLine = `${consistentPrefixForSpacing}${restOfLine.trimStart()}`;
		} else {
			// Line has no asterisk - add one
			const trimmed = line.trimStart();
			if (trimmed.startsWith('*')) {
				// Line has asterisk but no leading whitespace - normalize it
				const afterAsterisk = trimmed.substring(INDEX_ONE).trimStart();
				normalizedLine = `${consistentPrefixForSpacing}${afterAsterisk}`;
			} else {
				normalizedLine = `${consistentPrefixForSpacing}${trimmed}`;
			}
		}
		// Now process annotations on the normalized line
		// Normalize spacing for all annotations on the line (even if multiple)
		// The splitting logic will handle separating them later
		const annotationWithSpacingRegex =
			/(\s*\*\s*|\s+(?!\{))@([a-zA-Z_][a-zA-Z0-9_]*)(\s+)([^\n@]*?)(?=\s*@|\s*\*|\s*$)/g;

		// Process all annotations on the line from right to left to avoid index shifting
		const matches: {
			index: number;
			length: number;
			prefix: string;
			annotationName: string;
			content: string;
		}[] = [];

		for (const match of normalizedLine.matchAll(
			annotationWithSpacingRegex,
		)) {
			const prefix = match[INDEX_ONE] ?? '';
			const annotationName = match[INDEX_TWO] ?? '';
			const content = match[INDEX_FOUR] ?? '';
			const lowerName = annotationName.toLowerCase();
			if (APEXDOC_ANNOTATIONS.includes(lowerName as never)) {
				matches.push({
					annotationName: lowerName,
					content,
					index: match.index,
					length: match[ARRAY_START_INDEX].length,
					prefix,
				});
			}
		}

		// Replace from right to left to maintain correct indices
		if (matches.length > ARRAY_START_INDEX) {
			let resultLine = normalizedLine;
			for (
				let i = matches.length - INDEX_ONE;
				i >= ARRAY_START_INDEX;
				i--
			) {
				const match = matches[i];
				if (!match) continue;

				// Normalize content: trim and normalize multiple spaces to single space
				const trimmedContent = match.content.trim();
				const normalizedContent = trimmedContent.replace(/\s+/g, ' ');

				// Build normalized annotation
				// If annotation is at start of line, use consistent prefix
				// Otherwise preserve the original prefix
				const isAtLineStart =
					match.index === ARRAY_START_INDEX ||
					resultLine
						.substring(ARRAY_START_INDEX, match.index)
						.trim() === '';
				const annotationPrefix = isAtLineStart
					? consistentPrefixForSpacing
					: match.prefix;

				const normalizedAnnotation =
					normalizedContent.length > EMPTY
						? `${annotationPrefix}@${match.annotationName} ${normalizedContent}`
						: `${annotationPrefix}@${match.annotationName}`;

				// Replace in result line
				resultLine =
					resultLine.substring(ARRAY_START_INDEX, match.index) +
					normalizedAnnotation +
					resultLine.substring(match.index + match.length);
			}
			return resultLine;
		}

		// Fallback: Match single annotation at end of line
		const singleAnnotationRegex =
			/(\s*\*\s*|\s+(?!\{))@([a-zA-Z_][a-zA-Z0-9_]*)(\s+)([^\n@]*?)(\s*)$/;
		const singleMatch = singleAnnotationRegex.exec(normalizedLine);
		if (singleMatch) {
			const [, , annotationName, , content] = singleMatch;
			const lowerName = annotationName?.toLowerCase() ?? '';
			if (APEXDOC_ANNOTATIONS.includes(lowerName as never)) {
				// Normalize content: trim and normalize multiple spaces to single space
				const trimmedContent = (content ?? '').trim();
				const normalizedContent = trimmedContent.replace(/\s+/g, ' ');
				// Use consistent prefix for all annotations
				// Use single space after annotation if there's content
				return normalizedContent.length > EMPTY
					? `${consistentPrefixForSpacing}@${lowerName} ${normalizedContent}`
					: `${consistentPrefixForSpacing}@${lowerName}`;
			}
		}
		return normalizedLine;
	});
	// Now split lines that contain both text and annotations (e.g., " * text * @param value")
	// into separate lines
	// Track code blocks to skip processing for code block content
	let inCodeBlockForFinal = false;
	let codeBlockBraceCountForFinal = 0;
	const finalLines: string[] = [];
	for (const line of annotationNormalizedLines) {
		// Track code block boundaries
		if (line.includes('{@code')) {
			inCodeBlockForFinal = true;
			codeBlockBraceCountForFinal = DEFAULT_BRACE_COUNT; // Count the opening brace in {@code
			// Count additional braces in the line
			const afterCodeTag = line.substring(line.indexOf('{@code') + '{@code'.length);
			for (const char of afterCodeTag) {
				if (char === '{') codeBlockBraceCountForFinal++;
				if (char === '}') codeBlockBraceCountForFinal--;
			}
		}
		if (inCodeBlockForFinal) {
			// Skip processing for code block content lines (but not the {@code line itself)
			// Preserve code block content exactly as-is
			// IMPORTANT: Check this BEFORE counting braces, so we preserve the closing brace line
			if (!line.includes('{@code')) {
			// Count braces in this line
			for (const char of line) {
				if (char === '{') {
					codeBlockBraceCountForFinal++;
				} else if (char === '}') {
					codeBlockBraceCountForFinal--;
				}
			}
				// Code block ends when brace count reaches 0
				if (codeBlockBraceCountForFinal === ZERO_BRACE_COUNT) {
					inCodeBlockForFinal = false;
				}
				// Always preserve code block content lines exactly as-is
				finalLines.push(line);
				continue;
			}
			// For {@code line, count braces but don't skip (need to process it)
			for (const char of line) {
				if (char === '{') {
					codeBlockBraceCountForFinal++;
				} else if (char === '}') {
					codeBlockBraceCountForFinal--;
				}
			}
			if (codeBlockBraceCountForFinal === ZERO_BRACE_COUNT) {
				inCodeBlockForFinal = false;
			}
		}
		
		// Check if line contains both text and annotations
		// Match patterns like " * text * @param value" or " * text. * @param value * @return value"
		const annotationInMiddleRegex =
			/(\*\s*@[a-zA-Z_][a-zA-Z0-9_]*\s+[^\*]*?)(?=\s*\*|$)/g;
		const annotationMatches = [...line.matchAll(annotationInMiddleRegex)];
		if (annotationMatches.length > ARRAY_START_INDEX) {
			// Check if there's text before the first annotation
			const [firstMatch] = annotationMatches;
			if (
				firstMatch?.index !== undefined &&
				firstMatch.index > ARRAY_START_INDEX
			) {
				// There's text before the first annotation - split the line
				let lastIndex = ARRAY_START_INDEX;
				for (const match of annotationMatches) {
					// Add text before annotation
					const textBefore = line
						.substring(lastIndex, match.index)
						.trim();
					if (textBefore.length > EMPTY) {
						// Ensure it has the comment prefix
						const prefixedText = textBefore.startsWith('*')
							? textBefore
							: `${consistentPrefixForSpacing}${textBefore}`;
						finalLines.push(prefixedText);
					}
					// Add annotation - ensure it has the correct prefix
					const annotationPart = match[ARRAY_START_INDEX].trim();
					if (annotationPart.length > EMPTY) {
						// The annotation part should already have * at the start, but ensure it has the full prefix
						if (annotationPart.startsWith('*')) {
							// Extract the content after the asterisk
							const annotationContent = annotationPart
								.substring(INDEX_ONE)
								.trimStart();
							finalLines.push(
								`${consistentPrefixForSpacing}${annotationContent}`,
							);
						} else {
							finalLines.push(
								`${consistentPrefixForSpacing}${annotationPart}`,
							);
						}
					}
					lastIndex = match.index + match[ARRAY_START_INDEX].length;
				}
				// Add remaining text after last annotation
				const textAfter = line.substring(lastIndex).trim();
				if (textAfter.length > EMPTY) {
					const prefixedText = textAfter.startsWith('*')
						? textAfter
						: `${consistentPrefixForSpacing}${textAfter}`;
					finalLines.push(prefixedText);
				}
			} else {
				// No text before first annotation - line starts with annotation, keep as-is
				finalLines.push(line);
			}
		} else {
			// No annotations in middle - keep line as-is
			finalLines.push(line);
		}
	}
	normalizedComment = finalLines.join('\n');

	// Normalize @group values
	// Match @group followed by whitespace and a group name
	const groupRegex = /(\s*\*\s*@group\s+)([a-zA-Z_][a-zA-Z0-9_]*)(\s|$)/g;
	normalizedComment = normalizedComment.replace(
		groupRegex,
		// eslint-disable-next-line @typescript-eslint/max-params -- Regex replace callback requires 4 parameters
		(match, prefix, groupName, suffix) => {
			const lowerGroupName = String(groupName).toLowerCase();

			const properCase = APEXDOC_GROUP_NAMES[lowerGroupName];
			// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- properCase is string | undefined from Record lookup
			if (properCase) {
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- prefix and suffix are strings from regex match
				return `${prefix}${properCase}${suffix}`;
			}
			return match;
		},
	);

	/**
	 * Wraps a long annotation line to fit within the print width.
	 * @param lineToWrap - The annotation line that may need wrapping.
	 * @param wrapCommentIndent - The indentation level of the comment.
	 * @param wrapOptions - Parser options including printWidth, tabWidth, and useTabs.
	 * @returns The wrapped line(s) split by newlines if wrapping occurred, otherwise returns the original line unchanged.
	 * @example
	 * wrapAnnotationLine(' * @param veryLongParameterName description', 2, { printWidth: 80, tabWidth: 2, useTabs: false })
	 */
	const wrapAnnotationLine = (
		lineToWrap: Readonly<string>,
		wrapCommentIndent: number,
		wrapOptions: Readonly<ParserOptions>,
	): string => {
		const {
			printWidth: wrapPrintWidth,
			tabWidth: wrapTabWidth,
			useTabs: wrapUseTabs,
		} = wrapOptions;
		if (!wrapPrintWidth) return lineToWrap;

		const wrapBaseIndent = createIndent(
			wrapCommentIndent,
			wrapTabWidth,
			wrapUseTabs,
		);
		const wrapCommentPrefix = wrapBaseIndent + ' * ';
		const lineLength = lineToWrap.length;

		if (lineLength < wrapPrintWidth) return lineToWrap;

		// Find the annotation part (e.g., " * @param input")
		const annotationMatch = /^(\s*\*\s*@\w+\s+[^\s]+)/.exec(lineToWrap);
		const annotationMatchValue = annotationMatch?.[INDEX_ONE];
		// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- annotationMatchValue is string | undefined from regex exec
		if (!annotationMatchValue) {
			return lineToWrap;
		}

		const annotationPart = annotationMatch[INDEX_ONE];
		if (annotationPart === undefined) {
			return lineToWrap;
		}
		const remainingText = lineToWrap
			.substring(annotationPart.length)
			.trim();
		if (remainingText.length === EMPTY) return lineToWrap;

		// Calculate available width for the remaining text on the first line
		const annotationPartLength = annotationPart.length;
		const availableWidth = wrapPrintWidth - annotationPartLength;

		if (availableWidth < MAX_ANNOTATION_LINE_LENGTH) {
			// If annotation itself is too long, wrap after annotation
			return `${annotationPart}\n${wrapCommentPrefix}${remainingText}`;
		}

		// Try to wrap the remaining text
		const words = remainingText.split(/\s+/);
		const wrappedLines: string[] = [];
		let currentLine = annotationPart;

		for (const word of words) {
			const testLine = `${currentLine} ${word}`;
			if (testLine.length <= wrapPrintWidth) {
				currentLine = testLine;
			} else {
				if (currentLine !== annotationPart) {
					wrappedLines.push(currentLine);
				}
				// Start new line with comment prefix and word
				currentLine = `${wrapCommentPrefix}${word}`;
			}
		}

		if (
			annotationPart &&
			(currentLine !== annotationPart || wrappedLines.length === EMPTY)
		) {
			wrappedLines.push(currentLine);
		}

		return wrappedLines.join('\n');
	};

	/**
	 * Helper function to wrap text blocks with paragraph detection.
	 * Detects paragraph boundaries: if a line ends with sentence-ending punctuation
	 * and the next line starts with a capital letter, treat it as a new paragraph.
	 * @param textBlock - Array of text block lines to wrap.
	 * @param wrapCommentPrefix - The comment prefix to use (e.g., "   * ").
	 * @param wrapPrintWidth - The maximum line width for wrapping.
	 * @returns Array of wrapped lines.
	 */
	const wrapTextBlockWithParagraphs = (
		textBlock: string[],
		wrapCommentPrefix: string,
		wrapPrintWidth: number,
	): string[] => {
		// Extract all text from all lines in the text block
		const textParts = textBlock
			.map((line) => {
				const prefixMatch = /^(\s*\*\s*)/.exec(line);
				const prefix =
					prefixMatch?.[INDEX_ONE] ?? wrapCommentPrefix;
				return line.substring(prefix.length).trim();
			})
			.filter((text) => text.length > EMPTY);

		// Group text parts into paragraphs
		const paragraphs: string[] = [];
		let currentParagraph: string[] = [];

		for (let i = 0; i < textParts.length; i++) {
			const part = textParts[i];
			if (part === undefined || part.length === EMPTY) {
				continue;
			}

			const nextPart = textParts[i + INDEX_ONE];

			currentParagraph.push(part);

			// Check if this is a paragraph boundary:
			// - There is a newline (implicit, since we're processing separate lines)
			// - Next part exists and starts with a capital letter
			// This indicates a new paragraph, not a continuation
			const nextStartsWithCapital =
				nextPart !== undefined &&
				nextPart.length > EMPTY &&
				/^[A-Z]/.test(nextPart.trim());

			if (nextStartsWithCapital) {
				// This is a paragraph boundary - finish current paragraph
				paragraphs.push(currentParagraph.join(' '));
				currentParagraph = [];
			}
		}

		// Add the last paragraph if it exists
		if (currentParagraph.length > EMPTY) {
			paragraphs.push(currentParagraph.join(' '));
		}

		// Wrap each paragraph independently
		const wrappedLines: string[] = [];
		for (const paragraphText of paragraphs) {
			if (paragraphText.length > EMPTY) {
				const words = paragraphText.split(/\s+/);
				let currentTextLine = '';
				for (const word of words) {
					const testLine =
						currentTextLine === ''
							? word
							: `${currentTextLine} ${word}`;
					const testLineWithPrefix =
						wrapCommentPrefix + testLine;
					// Break if adding this word would make the line exceed printWidth
					// Allow lines to be exactly equal to printWidth (<= printWidth)
					if (testLineWithPrefix.length <= wrapPrintWidth) {
						currentTextLine = testLine;
					} else {
						// Adding this word would make the line > printWidth, so break before adding it
						if (currentTextLine !== '') {
							wrappedLines.push(
								wrapCommentPrefix + currentTextLine,
							);
						}
						currentTextLine = word;
					}
				}
				if (currentTextLine !== '') {
					wrappedLines.push(
						wrapCommentPrefix + currentTextLine,
					);
				}
			}
		}
		return wrappedLines;
	};

	// Wrap long annotation lines based on printWidth
	// Also join consecutive non-annotation text lines into single lines so Prettier
	// can wrap them as paragraphs instead of wrapping each line individually
	if (printWidth) {
		const annotationLinesForWrap = normalizedComment.split('\n');
		const wrappedLines: string[] = [];
		const baseIndentForWrap = createIndent(
			commentIndent,
			tabWidthValue,
			options.useTabs,
		);
		const wrapCommentPrefix = baseIndentForWrap + ' * ';
		let currentTextBlock: string[] = [];
		// Track code block indentation using a stack (shared with earlier normalization)
		// Each entry stores the detected indentation string for that code block level
		const codeBlockIndentStackForWrap: string[] = [];
		let insideCodeBlock = false;
		// Track brace depth within code blocks to properly detect the final closing brace
		let codeBlockBraceDepth = 0;
		for (
			let lineIndex = ARRAY_START_INDEX;
			lineIndex < annotationLinesForWrap.length;
			lineIndex++
		) {
			const annotationLine = annotationLinesForWrap[lineIndex] ?? '';
			// Check if line contains an annotation anywhere (not just at start)
			// Match * followed by @annotation anywhere in the line
			const isAnnotation = /\*\s*@[a-zA-Z_]/.test(annotationLine);
			const isCodeBlockStart = annotationLine.includes('{@code');
			const isCommentEnd = annotationLine.trim() === '*/';
			const isCommentStart = annotationLine.trim() === '/**';

			// Code block ends when we see a closing } that's on its own line
			// But we need to be careful - the closing } might be part of the code content
			// We'll detect it by checking if the line is just " * }" (after trimming asterisk and spaces)
			const trimmedLine = annotationLine.replace(/^\s*\*\s*/, '').trim();
			// Check if this is the closing brace of a code block
			// It should be just "}" on its own line (after removing comment markers)
			// However, if the next line is also just "}", then this is the code content closing brace,
			// and the next line is the {@code} closing brace - we should only end on the next one
			// Also, if the next line starts with "}" (like "};" or "},"), then this is code content, not the {@code} closing brace
			const nextLine = annotationLinesForWrap[lineIndex + INDEX_ONE];
			const nextTrimmed = nextLine?.replace(/^\s*\*\s*/, '').trim() ?? '';
			
			// Track brace depth within code blocks BEFORE checking if this line ends the block
			// We need to check the brace depth BEFORE updating it for the current line
			let currentBraceDepth = codeBlockBraceDepth;
			if (insideCodeBlock && !isCodeBlockStart) {
				// Count opening braces { in the line
				const openBraces = (trimmedLine.match(/\{/g) ?? []).length;
				// Count closing braces } in the line
				const closeBraces = (trimmedLine.match(/\}/g) ?? []).length;
				// Calculate what the brace depth will be AFTER processing this line
				// But check if this line ends the block BEFORE updating the depth
				currentBraceDepth = codeBlockBraceDepth + openBraces - closeBraces;
			}
			
			// Code block ends only when:
			// 1. We're inside a code block
			// 2. This line is just "}" (standalone closing brace)
			// 3. Brace depth will be 0 AFTER processing this line (we've closed all nested structures)
			// 4. Next line is NOT also just "}" (handles double closing braces)
			// 5. Next line does NOT start with "}" (handles "};" or "},")
			const isCodeBlockEnd =
				insideCodeBlock &&
				!isCommentEnd &&
				!isCommentStart &&
				!isCodeBlockStart &&
				trimmedLine === '}' &&
				currentBraceDepth === ARRAY_START_INDEX &&
				// Only end code block if next line is NOT also just a closing brace
				// (this handles the case where we have " * }" followed by " * }" - the second one ends the code block)
				// AND next line does NOT start with "}" (if it starts with "}", it's code content like "};" or "},")
				nextTrimmed !== '}' &&
				!nextTrimmed.startsWith('}');
			
			// Now update the brace depth for the next iteration
			if (insideCodeBlock && !isCodeBlockStart) {
				const openBraces = (trimmedLine.match(/\{/g) ?? []).length;
				const closeBraces = (trimmedLine.match(/\}/g) ?? []).length;
				codeBlockBraceDepth += openBraces - closeBraces;
			}
			const isCodeBlock =
				isCodeBlockStart || (insideCodeBlock && !isCodeBlockEnd);


			// Track code block state using stack
			if (isCodeBlockStart) {
				insideCodeBlock = true;
				codeBlockBraceDepth = INDEX_ONE; // Start with depth 1 for the {@code opening brace
				// Push empty string - will detect indentation from first continuation line
				codeBlockIndentStackForWrap.push('');
			}
			if (isCodeBlockEnd) {
				insideCodeBlock = false;
				codeBlockBraceDepth = ARRAY_START_INDEX;
				codeBlockIndentStackForWrap.pop();
			}

			// If we hit an annotation, code block, or comment boundary, flush the current text block
			// CRITICAL: Code block content lines must be preserved exactly as-is
			// Check for code block content FIRST before any other processing
			// This ensures code block content is NEVER processed by ApexDoc normalization
			if (insideCodeBlock && !isCodeBlockStart && !isCodeBlockEnd) {
				// Code block content line - preserve exactly as formatted by embed function
				// The embed function handles:
				//   1. Code formatting (via Prettier)
				//   2. Annotation normalization (via normalizeAnnotationNamesInText in formatCodeBlockDirect)
				// ApexDoc normalization (this function) must NOT touch code block content at all
				// We must NOT normalize, modify, or process these lines in any way
				if (currentTextBlock.length > EMPTY) {
					wrappedLines.push(
						...wrapTextBlockWithParagraphs(
							currentTextBlock,
							wrapCommentPrefix,
							printWidth,
						),
					);
					currentTextBlock = [];
				}
				wrappedLines.push(annotationLine);
			} else if (isAnnotation || isCodeBlock || isCommentEnd || isCommentStart) {
				if (currentTextBlock.length > EMPTY) {
					wrappedLines.push(
						...wrapTextBlockWithParagraphs(
							currentTextBlock,
							wrapCommentPrefix,
							printWidth,
						),
					);
					currentTextBlock = [];
				}

				// CRITICAL: Don't process annotations inside code blocks
				// Code block content lines (including lines with @ annotations) should be preserved as-is
				// The embed function already handles annotation normalization for code blocks
				if (isAnnotation && !insideCodeBlock) {
					// Ensure annotation lines have consistent indentation
					// Normalize multiple asterisks to single asterisk first
					let normalizedAnnotationLine = annotationLine;
					// Match leading whitespace, then one or more asterisks, then optional whitespace
					const linePrefixMatch = /^(\s*)(\*+)(\s*)/.exec(
						annotationLine,
					);
					if (linePrefixMatch) {
						const existingPrefix = linePrefixMatch[INDEX_ONE] ?? '';
						// Extract the rest of the line after the asterisk(s)
						let restOfLine = annotationLine.substring(
							linePrefixMatch[ARRAY_START_INDEX].length,
						);
						// Remove any additional asterisks (handle cases like "** @param" or "*** {@code")
						restOfLine = restOfLine.replace(/^\s*\*+\s*/, '');
						// If indentation doesn't match wrapCommentPrefix, normalize it
						if (
							existingPrefix.length !== baseIndentForWrap.length
						) {
							normalizedAnnotationLine = `${wrapCommentPrefix}${restOfLine.trimStart()}`;
						} else {
							// Indentation is correct, just normalize the asterisk
							normalizedAnnotationLine = `${wrapCommentPrefix}${restOfLine.trimStart()}`;
						}
					} else {
						// Line has no asterisk - add one
						const trimmed = annotationLine.trimStart();
						if (trimmed.startsWith('*')) {
							// Line has asterisk but no leading whitespace - normalize it
							const afterAsterisk = trimmed
								.substring(INDEX_ONE)
								.trimStart();
							normalizedAnnotationLine = `${wrapCommentPrefix}${afterAsterisk}`;
						} else {
							normalizedAnnotationLine = `${wrapCommentPrefix}${trimmed}`;
						}
					}

					// Keep appending continuation lines until we hit a non-continuation line
					// CRITICAL: Don't treat code block content lines as continuation lines
					// Code block content should be preserved as separate lines, not collapsed
					let continuationIndex = lineIndex + INDEX_ONE;
					// Track code block state during continuation scanning
					// Use the same logic as the main loop to detect code blocks
					let continuationInsideCodeBlock = insideCodeBlock;
					while (continuationIndex < annotationLinesForWrap.length) {
						const continuationLine = annotationLinesForWrap[continuationIndex];
						if (continuationLine === undefined) {
							break;
						}
						const continuationIsAnnotation = /\*\s*@[a-zA-Z_]/.test(
							continuationLine,
						);
						const continuationIsCodeBlockStart =
							continuationLine.includes('{@code');
						const continuationIsCommentEnd =
							continuationLine.trim() === '*/';
						const continuationIsCommentStart =
							continuationLine.trim() === '/**';
						
						// Track code block state for continuation lines (same logic as main loop)
						if (continuationIsCodeBlockStart) {
							continuationInsideCodeBlock = true;
						}
						
						// Check if this is the end of a code block (same logic as main loop)
						const continuationTrimmed = continuationLine.replace(/^\s*\*\s*/, '').trim();
						const continuationNextLine = annotationLinesForWrap[continuationIndex + INDEX_ONE];
						const continuationNextTrimmed = continuationNextLine?.replace(/^\s*\*\s*/, '').trim() ?? '';
						const continuationIsCodeBlockEnd =
							continuationInsideCodeBlock &&
							!continuationIsCommentEnd &&
							!continuationIsCommentStart &&
							!continuationIsCodeBlockStart &&
							continuationTrimmed === '}' &&
							continuationNextTrimmed !== '}' &&
							!continuationNextTrimmed.startsWith('}');
						
						if (continuationIsCodeBlockEnd) {
							continuationInsideCodeBlock = false;
						}
						
						// Don't treat code block content lines as continuation lines
						// If we're inside a code block, don't continue appending
						const continuationIsContinuation =
							!continuationIsAnnotation &&
							!continuationIsCodeBlockStart &&
							!continuationIsCommentEnd &&
							!continuationIsCommentStart &&
							!continuationInsideCodeBlock;

						if (!continuationIsContinuation) {
							break;
						}

						const continuationPrefixMatch = /^(\s*\*\s*)/.exec(
							continuationLine,
						);
						const continuationPrefix =
							continuationPrefixMatch?.[INDEX_ONE] ??
							wrapCommentPrefix;
						const continuationText = continuationLine
							.substring(continuationPrefix.length)
							.trim();
						if (continuationText.length > EMPTY) {
							normalizedAnnotationLine += ' ' + continuationText;
							continuationIndex++;
						} else {
							break;
						}
					}
					// Skip all the continuation lines we've included
					lineIndex = continuationIndex - INDEX_ONE;

					if (normalizedAnnotationLine.length >= printWidth) {
						const wrapped = wrapAnnotationLine(
							normalizedAnnotationLine,
							commentIndent,
							options,
						);
						// If wrapping produced multiple lines, split and add them
						if (wrapped.includes('\n')) {
							wrappedLines.push(...wrapped.split('\n'));
						} else {
							wrappedLines.push(wrapped);
						}
					} else {
						wrappedLines.push(normalizedAnnotationLine);
					}
				} else if (isCommentEnd || isCommentStart) {
					// Comment boundaries - normalize comment end if it has extra asterisks
					if (isCommentEnd && annotationLine.includes('**/')) {
						wrappedLines.push(
							annotationLine.replace(/\*{2,}\//, '*/'),
						);
					} else {
						wrappedLines.push(annotationLine);
					}
				} else if (isCodeBlockStart || isCodeBlockEnd) {
					// For code block start/end lines, ensure consistent indentation
					// Normalize multiple asterisks to single asterisk first
					let normalizedLine = annotationLine;
					// Match leading whitespace, then one or more asterisks, then optional whitespace
					const linePrefixMatch = /^(\s*)(\*+)(\s*)/.exec(
						annotationLine,
					);
					if (linePrefixMatch) {
						const existingPrefix = linePrefixMatch[INDEX_ONE] ?? '';
						// Extract the rest of the line after the asterisk(s)
						let restOfLine = annotationLine.substring(
							linePrefixMatch[ARRAY_START_INDEX].length,
						);
						// Remove any additional asterisks (handle cases like "*** {@code")
						restOfLine = restOfLine.replace(/^\s*\*+\s*/, '');
						// If indentation doesn't match wrapCommentPrefix, normalize it
						if (
							existingPrefix.length !== baseIndentForWrap.length
						) {
							normalizedLine = `${wrapCommentPrefix}${restOfLine.trimStart()}`;
						} else {
							// Indentation is correct, just normalize the asterisk
							normalizedLine = `${wrapCommentPrefix}${restOfLine.trimStart()}`;
						}
					} else {
						// Line has no asterisk - add one
						const trimmed = annotationLine.trimStart();
						if (trimmed.startsWith('*')) {
							// Line has asterisk but no leading whitespace - normalize it
							const afterAsterisk = trimmed
								.substring(INDEX_ONE)
								.trimStart();
							normalizedLine = `${wrapCommentPrefix}${afterAsterisk}`;
						} else {
							normalizedLine = `${wrapCommentPrefix}${trimmed}`;
						}
					}
					wrappedLines.push(normalizedLine);
				}
				// Note: Code block content lines are handled at the top of the if/else chain
				// to ensure they're preserved before any other processing
			} else {
				// Accumulate non-annotation lines into a text block
				// But check again if the line contains an annotation (might have been missed)
				// This can happen if annotations appear in the middle of a line after text
				// CRITICAL: Don't process annotations inside code blocks
				// Code block content lines (including lines with @ annotations) should be preserved as-is
				const hasAnnotationInMiddle = /\*\s*@[a-zA-Z_]/.test(
					annotationLine,
				);
				if (hasAnnotationInMiddle && !insideCodeBlock) {
					// Line contains annotation - flush text block and process as annotation line
					if (currentTextBlock.length > EMPTY) {
						wrappedLines.push(
							...wrapTextBlockWithParagraphs(
								currentTextBlock,
								wrapCommentPrefix,
								printWidth,
							),
						);
						currentTextBlock = [];
					}
					// Process the annotation line
					const isAnnotationLine = /\*\s*@[a-zA-Z_]/.test(
						annotationLine,
					);
					if (isAnnotationLine) {
						// Normalize multiple asterisks to single asterisk first
						let normalizedAnnotationLine = annotationLine;
						// Match leading whitespace, then one or more asterisks, then optional whitespace
						const linePrefixMatch = /^(\s*)(\*+)(\s*)/.exec(
							annotationLine,
						);
						if (linePrefixMatch) {
							const existingPrefix =
								linePrefixMatch[INDEX_ONE] ?? '';
							// Extract the rest of the line after the asterisk(s)
							let restOfLine = annotationLine.substring(
								linePrefixMatch[ARRAY_START_INDEX].length,
							);
							// Remove any additional asterisks (handle cases like "** @param")
							restOfLine = restOfLine.replace(/^\s*\*+\s*/, '');
							if (
								existingPrefix.length !==
								baseIndentForWrap.length
							) {
								normalizedAnnotationLine = `${wrapCommentPrefix}${restOfLine.trimStart()}`;
							} else {
								// Indentation is correct, just normalize the asterisk
								normalizedAnnotationLine = `${wrapCommentPrefix}${restOfLine.trimStart()}`;
							}
						} else {
							// Line has no asterisk - add one
							const trimmed = annotationLine.trimStart();
							if (trimmed.startsWith('*')) {
								// Line has asterisk but no leading whitespace - normalize it
								const afterAsterisk = trimmed
									.substring(INDEX_ONE)
									.trimStart();
								normalizedAnnotationLine = `${wrapCommentPrefix}${afterAsterisk}`;
							} else {
								normalizedAnnotationLine = `${wrapCommentPrefix}${trimmed}`;
							}
						}
						if (normalizedAnnotationLine.length >= printWidth) {
							const wrapped = wrapAnnotationLine(
								normalizedAnnotationLine,
								commentIndent,
								options,
							);
							if (wrapped.includes('\n')) {
								wrappedLines.push(...wrapped.split('\n'));
							} else {
								wrappedLines.push(wrapped);
							}
						} else {
							wrappedLines.push(normalizedAnnotationLine);
						}
					} else {
						wrappedLines.push(annotationLine);
					}
				} else {
					// No annotation - add to text block or preserve code block lines
					// If inside a code block (but not the start/end line), preserve the line as-is
					// CRITICAL: Code block content is already formatted by embed function
					// We must preserve it exactly as-is, including all indentation
					if (insideCodeBlock) {
						// Inside code block content - preserve exactly as formatted by embed function
						// The embed function handles formatting and annotation normalization for code blocks
						// We should NOT normalize or modify code block content lines
						// Just preserve the line exactly as formatted by the embed function
						wrappedLines.push(annotationLine);
					} else {
						// Not in code block - normalize asterisks before adding to text block
						// Normalize multiple asterisks to single asterisk first
						let normalizedLine = annotationLine;
						// Match leading whitespace, then one or more asterisks, then optional whitespace
						const linePrefixMatch = /^(\s*)(\*+)(\s*)/.exec(
							annotationLine,
						);
						if (linePrefixMatch) {
							const existingPrefix =
								linePrefixMatch[INDEX_ONE] ?? '';
							// Extract the rest of the line after the asterisk(s)
							let restOfLine = annotationLine.substring(
								linePrefixMatch[ARRAY_START_INDEX].length,
							);
							// Remove any additional asterisks
							restOfLine = restOfLine.replace(/^\s*\*+\s*/, '');
							if (
								existingPrefix.length !==
								baseIndentForWrap.length
							) {
								normalizedLine = `${wrapCommentPrefix}${restOfLine.trimStart()}`;
							} else {
								// Indentation is correct, just normalize the asterisk
								normalizedLine = `${wrapCommentPrefix}${restOfLine.trimStart()}`;
							}
						} else {
							// Line has no asterisk - add one
							const trimmed = annotationLine.trimStart();
							if (trimmed.startsWith('*')) {
								// Line has asterisk but no leading whitespace - normalize it
								const afterAsterisk = trimmed
									.substring(INDEX_ONE)
									.trimStart();
								normalizedLine = `${wrapCommentPrefix}${afterAsterisk}`;
							} else {
								normalizedLine = `${wrapCommentPrefix}${trimmed}`;
							}
						}
						currentTextBlock.push(normalizedLine);
					}
				}
			}
		}
		// Flush any remaining text block
		if (currentTextBlock.length > EMPTY) {
			wrappedLines.push(
				...wrapTextBlockWithParagraphs(
					currentTextBlock,
					wrapCommentPrefix,
					printWidth,
				),
			);
		}
		normalizedComment = wrappedLines.join('\n');
	}

	// Final normalization: ensure the last line (comment end) is always */, not **/
	// Only normalize the comment end line, not any other occurrences
	const commentEndLines = normalizedComment.split('\n');
	if (commentEndLines.length > ARRAY_START_INDEX) {
		const lastLineIndex = commentEndLines.length - INDEX_ONE;
		const lastLine = commentEndLines[lastLineIndex];
		if (lastLine !== undefined) {
			const lastLineTrimmed = lastLine.trim();
			if (lastLineTrimmed.endsWith('**/')) {
				commentEndLines[lastLineIndex] = lastLine.replace(
					/\*{2,}\//,
					'*/',
				);
			}
		}
		normalizedComment = commentEndLines.join('\n');
	}

	return normalizedComment;
};

export {
	FORMAT_FAILED_PREFIX,
	EMPTY_CODE_TAG,
	normalizeSingleApexDocComment,
};
export type { CodeBlock, ReadonlyCodeBlock };
