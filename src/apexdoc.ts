/**
 * @file Functions for finding and formatting ApexDoc code blocks within comments.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import type { ParserOptions } from 'prettier';
import { formatCodeBlockContent, processCodeBlockLines } from './apexdoc-code.js';
import { normalizeTypeNamesInCode } from './casing.js';
import { tokenizeCommentIntoParagraphs } from './comments.js';
import {
	createIndent,
	normalizeBlockComment,
	parseCommentToTokens,
	tokensToCommentString,
	wrapParagraphTokens,
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
} from './comments.js';
import {
	APEXDOC_ANNOTATIONS,
	APEXDOC_GROUP_NAMES,
} from './refs/apexdoc-annotations.js';
import { extractCodeFromBlock } from './apexdoc-code.js';
import { normalizeAnnotationNamesInText } from './annotations.js';
import { APEXDOC_GROUP_NAMES } from './refs/apexdoc-annotations.js';

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

	// Check if this comment contains {@code} blocks using token-based detection
	const commentTokens = parseCommentToTokens(commentValue);
	const hasCodeBlocks = commentTokens.some(token =>
		token.type === 'paragraph' && containsApexDocContent(token.content)
	);


	// Token-based implementation
	// First normalize basic structure
	let normalizedComment = normalizeBlockComment(commentValue, commentIndent, {
		tabWidth: tabWidthValue,
		useTabs: options.useTabs,
	});

	// NORMALIZE CODE BLOCK INDENTATION: After normalizeBlockComment standardizes indentation,
	// identify code block lines and apply consistent indentation for continuation lines.
	const normalizedLines = normalizedComment.split('\n');

	// Process lines to normalize code block indentation
	let inCodeBlock = false;
	let firstCodeLineIndex = -1;
	const processedLines = normalizedLines.map((line, index) => {
		if (index === 0 || index === normalizedLines.length - 1) return line; // Skip first and last lines

		// Detect {@code block start
		if (line.includes('{@code')) {
			inCodeBlock = true;
			firstCodeLineIndex = -1;
			return line;
		}

		// Detect {@code block end
		if (inCodeBlock && line.includes('}')) {
			inCodeBlock = false;
			return line;
		}

		if (inCodeBlock) {
			const match = line.match(/^(\s*)\*(\s*)(.+)$/);
			if (match) {
				const [, baseIndent, asteriskSpace, content] = match;
				const trimmedContent = content.trimStart();

				if (firstCodeLineIndex === -1 && trimmedContent) {
					// This is the first non-empty code line - preserve its indentation
					firstCodeLineIndex = index;
					return baseIndent + '*' + asteriskSpace + trimmedContent;
				} else if (trimmedContent) {
					// This is a continuation line - add 2 more spaces than the first line
					const result = baseIndent + '*' + ' '.repeat(asteriskSpace.length + 2) + trimmedContent;
					return result;
				}
			}
		}

		return line;
	});

	normalizedComment = processedLines.join('\n');

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

	// Process paragraph tokens: decide whether to pass through as regular comments
	// or let them be processed by ApexDoc detection functions
	let tokens = processParagraphTokensForApexDoc(initialTokens, normalizedComment);

	// Detect annotations and code blocks in tokens that contain ApexDoc content
	tokens = detectAnnotationsInTokens(tokens);
	tokens = detectCodeBlockTokens(tokens, normalizedComment);

	// Normalize annotations
	tokens = normalizeAnnotationTokens(tokens);

	// Wrap annotations if printWidth is available
	if (printWidth) {
		tokens = wrapAnnotationTokens(
			tokens,
			effectiveWidth,
			commentIndent,
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
export function processApexDocCommentLines(
	commentValue: string,
	commentIndent: number,
	options: ParserOptions,
	getFormattedCodeBlock: (key: string) => string | undefined,
): string[] {
	// Normalize the comment structure
	const normalizedComment = normalizeSingleApexDocComment(
		commentValue,
		0, // Use 0 for consistency with embed function
		options,
	);

	// Check if embed has already formatted code blocks
	const codeTagPos = normalizedComment.indexOf('{@code');
	const commentKey = codeTagPos !== -1 ? `${String(normalizedComment.length)}-${String(codeTagPos)}` : null;
	const embedFormattedComment = getFormattedCodeBlock(commentKey);

	if (embedFormattedComment) {
		// Use tokenization for embed-formatted comments
		const paragraphTokens = tokenizeCommentIntoParagraphs(normalizedComment);

		// Process each paragraph token
		const processedLines: string[] = [];

		for (const token of paragraphTokens) {
			const tokenLines = processParagraphToken(token, options, getFormattedCodeBlock, commentKey);
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

			apexDocTokens.push({
				type: 'text',
				content: lines.join('\n'),
				lines,
			} satisfies TextToken);
		} else if (token.type === 'code') {
			// Render CodeBlockTokens as text tokens with {@code ...} format
			let codeToUse = token.formattedCode ?? token.rawCode;
			// In sync version, normalize annotations in the code
			if (!token.formattedCode) {
				codeToUse = normalizeAnnotationNamesInText(codeToUse);
			}
			if (codeToUse.length > EMPTY) {
				const lines: string[] = [];
				const codeLines = codeToUse.split('\n');

				// Check if the code already includes {@code} wrapper (from embed)
				const alreadyWrapped = codeToUse.trim().startsWith('{@code');
				let finalCodeLines: string[];

				if (alreadyWrapped) {
					// Code is already wrapped, use as-is but ensure single-line format has space before }
					finalCodeLines = codeLines;
					if (finalCodeLines.length === 1) {
						const line = finalCodeLines[0];
						// For single-line {@code} blocks ending with ;}, add space before }
						if (line.includes(';') && line.endsWith('}')) {
							finalCodeLines[0] = line.slice(0, -1) + ' }';
						}
					}
				} else {
					// Check if this is a single-line code block that fits within the comment width
					const isSingleLine = codeLines.length === 1;
					const singleLineContent = codeLines[0]?.trim() ?? '';
					const singleLineWithBraces = `{@code ${singleLineContent} }`;
					const fitsOnOneLine = singleLineWithBraces.length <= options.printWidth - commentPrefix.length;

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
					lines.push(`${commentPrefix}${codeLine}`);
				}

				apexDocTokens.push({
					type: 'text',
					content: lines.join('\n'),
					lines,
				} satisfies TextToken);
			}
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

	// Process paragraph tokens: decide whether to pass through as regular comments
	// or let them be processed by ApexDoc detection functions
	tokens = processParagraphTokensForApexDoc(tokens, normalizedComment);

	return {
		tokens,
		effectiveWidth,
	};
};

/**
 * Processes paragraph tokens to decide whether they should be passed through as regular comments
 * or broken up into ApexDoc-specific tokens (annotations, code blocks).
 * @param tokens - Array of comment tokens including paragraph tokens.
 * @param originalComment - The original normalized comment string for position tracking.
 * @returns Array of processed tokens.
 */
const processParagraphTokensForApexDoc = (
	tokens: readonly CommentToken[],
	originalComment: Readonly<string>,
): readonly CommentToken[] => {
	const processedTokens: CommentToken[] = [];

	for (const token of tokens) {
		if (token.type === 'paragraph') {
			// Check if this paragraph contains ApexDoc-specific content
			const hasApexDocContent = containsApexDocContent(token.content);

			// Keep all paragraphs as paragraphs - they will be handled correctly by tokensToCommentString
			processedTokens.push(token);
		} else {
			// Keep other token types as-is
			processedTokens.push(token);
		}
	}

	return processedTokens;
};

/**
 * Checks if a paragraph content contains ApexDoc-specific elements like annotations or code blocks.
 * @param content - The paragraph content to check.
 * @returns True if the content contains ApexDoc elements.
 */
const containsApexDocContent = (content: string): boolean => {
	// Check for annotations (@param, @return, etc.)
	if (/@\w+/.test(content)) {
		return true;
	}

	// Check for code blocks ({@code ...})
	if (/{@code[^}]*}/.test(content)) {
		return true;
	}

	return false;
};


/**
 * Normalizes comment annotations to lowercase (JSDoc format).
 * @param text - The text to normalize.
 * @returns The text with annotations lowercased.
 */
const normalizeCommentAnnotations = (text: string): string => {
	// Simple regex to find @AnnotationName and convert to @annotationname
	return text.replace(/(@\w+)/g, (match) => match.toLowerCase());
};

/**
 * Normalizes annotations outside {@code} blocks while preserving {@code} block content.
 * @param commentValue - The comment value to normalize.
 * @returns The comment with annotations normalized outside {@code} blocks.
 */
const normalizeAnnotationsOutsideCodeBlocks = (commentValue: string): string => {
	let result = '';
	let lastIndex = 0;

	// Find all {@code} blocks
	const codeRegex = /\{@code[\s\S]*?\}/g;
	let match;

	while ((match = codeRegex.exec(commentValue)) !== null) {
		// Process text before this {@code} block
		const beforeCode = commentValue.substring(lastIndex, match.index);
		const normalizedBefore = normalizeCommentAnnotations(beforeCode);

		// Add normalized text + the {@code} block unchanged
		result += normalizedBefore + match[0];
		lastIndex = match.index + match[0].length;
	}

	// Process remaining text after the last {@code} block
	const afterCode = commentValue.substring(lastIndex);
	result += normalizeCommentAnnotations(afterCode);

	return result;
};

/**
 * Detects annotations in tokens and converts TextTokens/ParagraphTokens to AnnotationTokens.
 * Scans tokens for @param, @return, etc. patterns.
 * @param tokens - Array of comment tokens.
 * @returns Array of tokens with annotations detected.
 */
const detectAnnotationsInTokens = (
	tokens: readonly CommentToken[],
): readonly CommentToken[] => {
	const newTokens: CommentToken[] = [];
	// Annotation pattern: @ followed by identifier, possibly with content
	const annotationPattern =
		/(\s*\*\s*|\s+(?!\{)|\s*\*\s*\.\s*\*\s*)@([a-zA-Z_][a-zA-Z0-9_]*)(\s*[^\n@]*?)(?=\s*@|\s*\*|\s*$)/g;

	for (const token of tokens) {
		if (token.type === 'text' || token.type === 'paragraph') {
			// Check each line for annotations
			const tokenLines = token.lines;
			let processedLines: string[] = [];
			let hasAnnotations = false;

			for (const line of tokenLines) {
				const matches = [...line.matchAll(annotationPattern)];
				if (matches.length > EMPTY) {
					hasAnnotations = true;
					// Process each annotation match
					for (const match of matches) {
						const annotationName = match[INDEX_TWO] ?? '';
						const content = (match[INDEX_THREE] ?? '').trim();
						const lowerName = annotationName.toLowerCase();

						// Extract text before annotation if any
						const beforeAnnotation = line.substring(
							ARRAY_START_INDEX,
							match.index ?? ARRAY_START_INDEX,
						);
						const beforeText = beforeAnnotation
							.replace(/^\s*\*\s*/, '')
							.trim();

						if (beforeText.length > EMPTY) {
							newTokens.push({
								type: 'annotation',
								name: lowerName,
								content,
								followingText: beforeText,
							} satisfies AnnotationToken);
						} else {
							newTokens.push({
								type: 'annotation',
								name: lowerName,
								content,
							} satisfies AnnotationToken);
						}
					}
				} else {
					processedLines.push(line);
				}
			}

			if (!hasAnnotations) {
				newTokens.push(token);
			} else if (processedLines.length > EMPTY) {
				const remainingContent = processedLines
					.map((l) => l.replace(/^\s*\*\s*/, '').trim())
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
	const CODE_TAG = '{@code';

	for (const token of tokens) {
		if (token.type === 'text' || token.type === 'paragraph') {
			// For paragraphs, work with the lines array to preserve line breaks
			// For text tokens, reconstruct content from lines
			const content = token.type === 'paragraph'
				? token.lines.map(line => line.replace(/^\s*\*\s*/, '')).join('\n')
				: token.content;
			let currentPos = ARRAY_START_INDEX;
			let lastMatchEnd = ARRAY_START_INDEX;

			while (currentPos < content.length) {
				const codeTagStart = content.indexOf(CODE_TAG, currentPos);

				if (codeTagStart === NOT_FOUND_INDEX) {
					if (currentPos < content.length) {
						const remainingText = content.substring(currentPos);
						if (remainingText.length > EMPTY) {
							newTokens.push({
								type: 'text',
								content: remainingText,
								lines: remainingText.split('\n'),
							} satisfies TextToken);
						}
					}
					break;
				}

				if (codeTagStart > lastMatchEnd) {
					const textBeforeCode = content.substring(lastMatchEnd, codeTagStart);
					if (textBeforeCode.length > EMPTY) {
						const lines = textBeforeCode.split('\n').filter(line => line.trim().length > 0);
						if (lines.length > 0) {
							newTokens.push({
								type: 'text',
								content: textBeforeCode,
								lines: lines.map(line => ` * ${line}`),
							} satisfies TextToken);
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
 * @param tokens - Array of comment tokens.
 * @returns Array of tokens with normalized annotation names.
 */
const normalizeAnnotationTokens = (
	tokens: readonly CommentToken[],
): readonly CommentToken[] => {
	return tokens.map((token) => {
		if (token.type === 'annotation') {
			const lowerName = token.name.toLowerCase();
			if (APEXDOC_ANNOTATIONS.includes(lowerName as never)) {
				let normalizedContent = token.content;
				// Special handling for @group annotations - normalize the group name
				if (lowerName === 'group' && token.content) {
					const lowerContent = token.content.toLowerCase().trim();
					normalizedContent = APEXDOC_GROUP_NAMES[lowerContent as keyof typeof APEXDOC_GROUP_NAMES] ?? token.content;
				}
				return { ...token, name: lowerName, content: normalizedContent } satisfies AnnotationToken;
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
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): readonly CommentToken[] => {
	const newTokens: CommentToken[] = [];

	for (const token of tokens) {
		if (token.type === 'annotation') {
			const annotationContent = token.content;
			const annotationPrefixLength = `@${token.name} `.length;
			const availableWidth = effectiveWidth - annotationPrefixLength;

			if (availableWidth <= EMPTY) {
				newTokens.push(token);
				continue;
			}

			const words = annotationContent.split(/\s+/);
			let currentLine = '';
			const wrappedLines: string[] = [];

			for (const word of words) {
				const testLine =
					currentLine === '' ? word : `${currentLine} ${word}`;
				if (testLine.length <= availableWidth) {
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

			const newContent = wrappedLines.join('\n');
			newTokens.push({ ...token, content: newContent } satisfies AnnotationToken);
		} else {
			newTokens.push(token);
		}
	}

	return newTokens;
};

/**
 * Token-based normalization of ApexDoc comment (experimental).
 * This function uses the new token system for comment processing.
 * @param commentValue - The comment text.
 * @param commentIndent - The indentation level.
 * @param options - Parser options.
 * @returns The normalized comment.
 */
const normalizeSingleApexDocCommentWithTokens = async (
	commentValue: Readonly<string>,
	commentIndent: number,
	options: Readonly<ParserOptions>,
): Promise<string> => {
	const { printWidth, tabWidth } = options;
	const tabWidthValue = tabWidth;

	// First normalize basic structure
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

	// Detect annotations
	let tokens = detectAnnotationsInTokens(initialTokens);

	// Detect code blocks
	tokens = detectCodeBlockTokens(tokens, normalizedComment);

	// Normalize annotations
	tokens = normalizeAnnotationTokens(tokens);

	// Format code blocks (async)
	const { formatCodeBlockToken } = await import('./apexdoc-code.js');
	const formattedTokens: CommentToken[] = [];
	for (const token of tokens) {
		if (token.type === 'code' && token.rawCode.length > EMPTY) {
			const formattedToken = await formatCodeBlockToken({
				token,
				effectiveWidth,
				embedOptions: options,
				currentPluginInstance: undefined,
			});
			formattedTokens.push(formattedToken);
		} else {
			formattedTokens.push(token);
		}
	}

	// Wrap annotations
	tokens = wrapAnnotationTokens(
		formattedTokens,
		effectiveWidth,
		commentIndent,
		{
			tabWidth: tabWidthValue,
			useTabs: options.useTabs,
		},
	);

	// Convert tokens back to string
	const { tokensToCommentString, wrapParagraphTokens } = await import(
		'./comments.js'
	);

	// Wrap paragraphs if needed
	const finalTokens = printWidth
		? wrapParagraphTokens(
				tokens,
				printWidth,
				commentIndent,
				{
					tabWidth: tabWidthValue,
					useTabs: options.useTabs,
				},
			)
		: tokens;

	return tokensToApexDocString(finalTokens, commentIndent, {
		tabWidth: tabWidthValue,
		useTabs: options.useTabs,
		printWidth: printWidth,
	});
};

export {
	FORMAT_FAILED_PREFIX,
	EMPTY_CODE_TAG,
	normalizeSingleApexDocComment,
	parseApexDocTokens,
	detectAnnotationsInTokens,
	detectCodeBlockTokens,
	normalizeAnnotationTokens,
	wrapAnnotationTokens,
	normalizeSingleApexDocCommentWithTokens,
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
	if (token.isApexDoc) {
		return processApexDocParagraph(token, options, getFormattedCodeBlock, commentKey, embedOptions);
	} else {
		return processRegularParagraph(token);
	}
}

/**
 * Processes a regular (non-ApexDoc) paragraph.
 */
function processRegularParagraph(token: import('./comments.js').ParagraphToken): string[] {
	// For regular paragraphs, just return the content as-is
	return token.content.split('\n');
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
	options: ParserOptions,
	getFormattedCodeBlock: (key: string) => string | undefined,
	commentKey: string | null,
	embedOptions: ParserOptions,
): string[] {
	// Extract content between {@code and }
	const match = codeBlock.match(/^\{@code\s*([\s\S]*?)\s*\}$/);
	if (!match) return [codeBlock];

	const codeContent = match[1];
	const lines = codeContent.split('\n');

	if (lines.length === 1) {
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
			let baseIndent = '';
			for (const line of embedLines) {
				const match = line.match(/^(\s*)\*/);
				if (match) {
					baseIndent = match[1] ?? '';
					break;
				}
			}

			const lines = embedLines.map(line => {
				// Remove the standard comment prefix but preserve relative indentation
				const match = line.match(/^(\s*\*\s?)(.*)$/);
				if (match) {
					return match[2]; // Keep only the content after the comment prefix
				}
				return line;
			});

			// Find the {@code block
			const codeStart = lines.findIndex(line => line.startsWith('{@code'));
			const codeEnd = lines.findIndex((line, i) => i > codeStart && line === '}');

			if (codeStart >= 0 && codeEnd > codeStart) {
				const codeLines = lines.slice(codeStart + 1, codeEnd);
				// Apply normalization to ensure correct casing
				const normalizedCode = codeLines.join('\n');
				const fullyNormalizedCode = normalizeTypeNamesInCode(normalizedCode);
				let normalizedLines = fullyNormalizedCode.split('\n');

				// For embed results, the formatted code is stored without comment prefixes
				// comments.ts will handle adding the proper indentation

				return [`{@code`, ...normalizedLines, `}`];
			}

			// Fallback
			return [`{@code`, ...lines.slice(2), `}`]; // Skip "Example usage:" and "{@code"
		} else {
			// Fallback to original format
			return [`{@code`, ...lines, `}`];
		}
	}
}

export type { CodeBlock, ReadonlyCodeBlock };
