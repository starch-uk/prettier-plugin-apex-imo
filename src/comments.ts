/**
 * @file Utility functions for finding and processing ApexDoc comments and their indentation.
 */

import type { ParserOptions } from 'prettier';
import type { AstPath, Doc } from 'prettier';
import * as prettier from 'prettier';
import type { ApexNode } from './types.js';
import {
	normalizeSingleApexDocComment,
	normalizeAnnotationTokens,
	removeTrailingEmptyLines,
} from './apexdoc.js';

const MIN_INDENT_LEVEL = 0;
const DEFAULT_TAB_WIDTH = 2;
const ARRAY_START_INDEX = 0;
const STRING_OFFSET = 1;
const INDEX_ONE = 1;
const INDEX_TWO = 2;

/**
 * Checks if a comment node is an Apex comment.
 * This identifies comments that can have ApexDoc annotations and formatting.
 * @param comment - The comment node to check.
 * @returns True if the comment is an Apex comment, false otherwise.
 */

/**
 * Safely extracts a comment node from an unknown type.
 * This is used by comment handling functions to ensure type safety.
 * @param comment - The unknown comment to extract.
 * @returns The comment node if valid, null otherwise.
 */
// Apex AST node types that allow dangling comments
const ALLOW_DANGLING_COMMENTS = [
	'apex.jorje.data.ast.ClassDeclaration',
	'apex.jorje.data.ast.InterfaceDeclaration',
	'apex.jorje.data.ast.EnumDeclaration',
	'apex.jorje.data.ast.TriggerDeclarationUnit',
	'apex.jorje.data.ast.Stmnt$BlockStmnt',
];

/**
 * Handles dangling comments in empty blocks and declarations.
 * Attaches comments that would otherwise be dangling to appropriate parent nodes.
 * @param comment - The comment node to handle.
 * @returns True if the comment was handled, false otherwise.
 */
const handleDanglingComment = (comment: unknown): boolean => {
	if (!comment || typeof comment !== 'object') return false;

	const commentWithContext = comment as {
		enclosingNode?: ApexNode;
		'@class'?: string;
	};

	const { enclosingNode } = commentWithContext;
	if (
		enclosingNode &&
		enclosingNode['@class'] &&
		ALLOW_DANGLING_COMMENTS.includes(enclosingNode['@class']) &&
		((enclosingNode as { stmnts?: unknown[] }).stmnts?.length === 0 ||
			(enclosingNode as { members?: unknown[] }).members?.length === 0)
	) {
		const { addDanglingComment } = prettier.util;
		addDanglingComment(enclosingNode, comment, null);
		return true;
	}
	return false;
};

/**
 * Handles leading comments before block statements.
 * Moves leading comments before block statements into the block itself for better formatting.
 * @param comment - The comment node to handle.
 * @returns True if the comment was handled, false otherwise.
 */
const handleBlockStatementLeadingComment = (comment: unknown): boolean => {
	if (!comment || typeof comment !== 'object') return false;

	const commentWithContext = comment as {
		followingNode?: ApexNode;
		'@class'?: string;
	};

	const { followingNode } = commentWithContext;
	if (
		!followingNode ||
		followingNode['@class'] !== 'apex.jorje.data.ast.Stmnt$BlockStmnt'
	) {
		return false;
	}

	const blockStatement = followingNode as { stmnts?: unknown[] };
	const { addLeadingComment, addDanglingComment } = prettier.util;

	if (blockStatement.stmnts && blockStatement.stmnts.length > 0) {
		// Add as leading comment to first statement in block
		addLeadingComment(blockStatement.stmnts[0], comment);
	} else {
		// Add as dangling comment to empty block
		addDanglingComment(followingNode, comment, null);
	}
	return true;
};

/**
 * Handles end-of-line comments in binary expressions.
 * Attaches trailing comments to the right child of binary expressions instead of the entire expression.
 * @param comment - The comment node to handle.
 * @returns True if the comment was handled, false otherwise.
 */
const handleBinaryExpressionTrailingComment = (comment: unknown): boolean => {
	if (!comment || typeof comment !== 'object') return false;

	const commentWithContext = comment as {
		precedingNode?: ApexNode;
		placement?: string;
		'@class'?: string;
	};

	const { precedingNode, placement } = commentWithContext;
	if (
		placement !== 'endOfLine' ||
		!precedingNode ||
		(precedingNode['@class'] !== 'apex.jorje.data.ast.Expr$BinaryExpr' &&
			precedingNode['@class'] !== 'apex.jorje.data.ast.Expr$BooleanExpr')
	) {
		return false;
	}

	const binaryExpr = precedingNode as { right?: unknown };
	if (!binaryExpr.right) return false;

	const { addTrailingComment } = prettier.util;
	addTrailingComment(binaryExpr.right, comment);
	return true;
};


const getIndentLevel = (
	line: Readonly<string>,
	tabWidth: number = DEFAULT_TAB_WIDTH,
): number => {
	// Regex always matches (at minimum empty string), so exec() never returns null
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const [match] = /^[\t ]*/.exec(line)!;
	return match.replace(/\t/g, ' '.repeat(tabWidth)).length;
};

const createIndent = (
	level: Readonly<number>,
	tabWidth: Readonly<number>,
	useTabs?: Readonly<boolean | null | undefined>,
): string =>
	level <= MIN_INDENT_LEVEL
		? ''
		: useTabs === true
			? '\t'.repeat(Math.floor(level / tabWidth))
			: ' '.repeat(level);

const findLineStart = (text: string, pos: number): number => {
	let lineStart = pos;
	while (
		lineStart > ARRAY_START_INDEX &&
		text[lineStart - STRING_OFFSET] !== '\n'
	)
		lineStart--;
	return lineStart;
};

const getCommentIndent = (
	text: Readonly<string>,
	commentStart: number,
): number => {
	// Since commentStart is at / in /**, we know text[commentStart + 1] is *
	// skipToLineEnd returns commentStart, and skipNewline doesn't advance past it,
	// so we can always find the * at commentStart + 1
	const asteriskInCommentStart = commentStart + STRING_OFFSET;
	const lineStart = findLineStart(text, asteriskInCommentStart);
	return getIndentLevel(
		text.substring(lineStart, asteriskInCommentStart),
		DEFAULT_TAB_WIDTH,
	);
};

/**
 * Normalizes comment start marker: /***** -> /**
 */
const normalizeCommentStart = (comment: string): string => {
	// Find first non-whitespace character
	let start = 0;
	while (
		start < comment.length &&
		(comment[start] === ' ' || comment[start] === '\t')
	) {
		start++;
	}
	// If we find /*, normalize multiple asterisks
	if (comment.substring(start).startsWith('/*')) {
		const prefix = comment.substring(0, start);
		const afterSlash = comment.substring(start + 1);
		// Count asterisks after /
		let asteriskCount = 0;
		while (
			asteriskCount < afterSlash.length &&
			afterSlash[asteriskCount] === '*'
		) {
			asteriskCount++;
		}
		// Normalize to exactly two asterisks (/**)
		if (asteriskCount > 2) {
			return prefix + '/**' + afterSlash.substring(asteriskCount);
		} else if (asteriskCount === 1) {
			// Only one asterisk, need to add one more
			return prefix + '/**' + afterSlash.substring(1);
		}
	}
	return comment;
};

/**
 * Normalizes comment end marker: multiple asterisks before slash to single asterisk.
 */
const normalizeCommentEnd = (comment: string): string => {
	// Replace **/ or more with */ - scan for patterns and replace
	let result = comment;
	let pos = 0;
	while (pos < result.length) {
		// Look for */ pattern
		const slashPos = result.indexOf('/', pos);
		if (slashPos === -1) break;

		// Count asterisks before /
		let asteriskCount = 0;
		let checkPos = slashPos - 1;
		while (checkPos >= 0 && result[checkPos] === '*') {
			asteriskCount++;
			checkPos--;
		}

		// If we have 2+ asterisks before /, normalize to */
		if (asteriskCount >= 2) {
			const replaceStart = checkPos + 1;
			result =
				result.substring(0, replaceStart) +
				'*/' +
				result.substring(slashPos + 1);
			pos = replaceStart + 2;
		} else {
			pos = slashPos + 1;
		}
	}
	return result;
};

/**
 * Normalizes a single comment line with asterisk prefix.
 */
const normalizeCommentLine = (
	line: string,
	baseIndent: string,
	isFirstOrLast: boolean,
): string => {
	if (isFirstOrLast) {
		// First/last lines are already normalized by normalizeCommentEnd on entire comment
		return line;
	}

	// Find asterisk position
	let asteriskPos = -1;
	for (let i = 0; i < line.length; i++) {
		if (line[i] === ' ' || line[i] === '\t') {
			continue;
		}
		if (line[i] === '*') {
			asteriskPos = i;
			break;
		}
		// No asterisk found before content
		break;
	}

	if (asteriskPos === -1) {
		// No asterisk - check if trimmed starts with *
		const trimmed = line.trimStart();
		if (trimmed.startsWith('*')) {
			const afterAsterisk = trimmed.substring(1).trimStart();
			return `${baseIndent} * ${afterAsterisk}`;
		}
		return `${baseIndent} * ${line.trimStart()}`;
	}

	// Found asterisk - normalize
	const beforeAsterisk = line.substring(0, asteriskPos);
	let afterAsterisk = line.substring(asteriskPos + 1);
	// Skip multiple asterisks
	while (afterAsterisk.startsWith('*')) {
		afterAsterisk = afterAsterisk.substring(1);
	}
	// Skip whitespace after asterisk(s)
	const spaceAfterAsterisk = afterAsterisk.match(/^\s*/)?.[0] ?? '';
	afterAsterisk = afterAsterisk.trimStart();
	// Remove any remaining asterisks at start of content
	while (afterAsterisk.startsWith('*')) {
		afterAsterisk = afterAsterisk.substring(1).trimStart();
	}
	// Preserve code block indentation (spaces beyond first)
	const codeBlockIndent =
		spaceAfterAsterisk.length > 1 ? spaceAfterAsterisk.substring(1) : '';
	return `${baseIndent} * ${codeBlockIndent}${afterAsterisk}`;
};


/**
 * Normalizes a block comment to standard format.
 * Handles malformed comments by normalizing markers, asterisks, and indentation.
 * Optionally uses token-based system for paragraph wrapping.
 * @param commentValue - The comment text (e.g., comment block).
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth, useTabs, printWidth, and useTokenSystem.
 * @returns The normalized comment value.
 */
const normalizeBlockComment = (
	commentValue: Readonly<string>,
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
		readonly printWidth?: number;
		readonly useTokenSystem?: boolean;
	}>,
): string => {
	// If token system is requested and printWidth is available, use it
	if (
		options.useTokenSystem === true &&
		options.printWidth !== undefined &&
		options.printWidth > EMPTY
	) {
		// First normalize basic structure
		let basicNormalized = normalizeCommentStart(commentValue);
		basicNormalized = normalizeCommentEnd(basicNormalized);

		// Normalize lines
		const lines = basicNormalized.split('\n');
		const normalizedLines: string[] = [];
		const baseIndent = createIndent(
			commentIndent,
			options.tabWidth,
			options.useTabs,
		);
		for (let i = ARRAY_START_INDEX; i < lines.length; i++) {
			const line = lines[i] ?? '';
			const isFirstOrLast =
				i === ARRAY_START_INDEX || i === lines.length - INDEX_ONE;
			normalizedLines.push(
				normalizeCommentLine(line, baseIndent, isFirstOrLast),
			);
		}
		basicNormalized = normalizedLines.join('\n');

		// Parse to tokens
		const tokens = parseCommentToTokens(basicNormalized);

		// Wrap paragraphs if needed
		const wrappedTokens = wrapParagraphTokens(
			tokens,
			options.printWidth,
			commentIndent,
			{
				tabWidth: options.tabWidth,
				useTabs: options.useTabs,
			},
		);

		// Convert back to string
		return tokensToCommentString(wrappedTokens, commentIndent, {
			tabWidth: options.tabWidth,
			useTabs: options.useTabs,
		});
	}

	// Use basic normalization (original implementation)
	let normalizedComment = normalizeCommentStart(commentValue);
	normalizedComment = normalizeCommentEnd(normalizedComment);

	// Normalize lines
	const lines = normalizedComment.split('\n');
	const normalizedLines: string[] = [];
	const baseIndent = createIndent(
		commentIndent,
		options.tabWidth,
		options.useTabs,
	);
	for (let i = ARRAY_START_INDEX; i < lines.length; i++) {
		const line = lines[i] ?? '';
		const isFirstOrLast =
			i === ARRAY_START_INDEX || i === lines.length - INDEX_ONE;
		normalizedLines.push(
			normalizeCommentLine(line, baseIndent, isFirstOrLast),
		);
	}
	return normalizedLines.join('\n');
};

const EMPTY = 0;
const NOT_FOUND_INDEX = -1;

/**
 * Detects if a block comment is malformed.
 * Checks for common formatting issues like extra asterisks, missing asterisks, or inconsistent spacing.
 * @param commentValue - The comment text to check
 * @returns True if the comment is malformed, false otherwise
 */
function isMalformedCommentBlock(commentValue: string): boolean {
	const lines = commentValue.split('\n');

	// Skip first and last lines (comment markers)
	for (let i = 1; i < lines.length - 1; i++) {
		const line = lines[i] ?? '';
		const trimmed = line.trim();

		// Check for lines with multiple consecutive asterisks, missing asterisk prefix, or inconsistent spacing
		if (
			/\*{2,}/.test(line) ||
			(trimmed && !trimmed.startsWith('*') && trimmed.length > 0) ||
			/^\s+\*\s{2,}/.test(line) ||
			/^\s+\*\s*$/.test(line)
		) {
			return true;
		}
	}

	return false;
}

// Token type definitions for comment processing
//
// ANALYSIS: Token Type Usage
// - TextToken: Fallback token when no paragraphs detected in comment
// - ParagraphToken: Main token type for paragraph content with wrapping
// - CodeBlockToken: Specialized for {@code} blocks
// - AnnotationToken: Specialized for ApexDoc annotations (@param, @return, etc.)
//
// POTENTIAL SIMPLIFICATIONS:
// 1. TextToken vs ParagraphToken: TextToken could be merged into ParagraphToken
//    since both have content (string) and lines (string[]) fields. However,
//    this would require updating ~20+ usages across apexdoc.ts and extensive testing.
//    Left for future major refactoring.
// 2. CodeBlockToken: Necessary for {@code} block processing
// 3. AnnotationToken: Necessary for ApexDoc annotation handling
//
interface TextToken {
	readonly type: 'text';
	readonly content: string;
	readonly lines: readonly string[];
}

interface ParagraphToken {
	readonly type: 'paragraph';
	readonly content: string;
	readonly lines: readonly string[];
	readonly isContinuation: boolean;
}

interface CodeBlockToken {
	readonly type: 'code';
	readonly startPos: number;
	readonly endPos: number;
	readonly rawCode: string;
	readonly formattedCode?: string;
}

interface AnnotationToken {
	readonly type: 'annotation';
	readonly name: string;
	readonly content: string;
	readonly followingText?: string;
}

type CommentToken =
	| TextToken
	| ParagraphToken
	| CodeBlockToken
	| AnnotationToken;

/**
 * Removes comment prefix (asterisk and spaces) from a line.
 * @param line - Line to remove prefix from.
 * @param preserveIndent - If true, uses original regex without trim to preserve code indentation. Otherwise trims result.
 * @returns Line with prefix removed and optionally trimmed.
 */
const removeCommentPrefix = (
	line: string,
	preserveIndent: boolean = false,
): string => {
	// Use original regex: /^\s*(\*(\s*\*)*)\s*/ - removes leading whitespace, asterisk(s), and all trailing whitespace
	const result = line.replace(/^\s*(\*(\s*\*)*)\s*/, '');
	return preserveIndent ? result : result.trim();
};

/**
 * Detects code blocks (slash-asterisk ... asterisk-slash) within comment text using character scanning.
 * This replaces regex-based detection for better control and performance.
 * @param text - The comment text content to scan.
 * @returns Array of code block objects with start, end, and content positions.
 */
const detectCodeBlocks = (
	text: string,
): Array<{ start: number; end: number; content: string }> => {
	const codeBlocks: Array<{ start: number; end: number; content: string }> = [];
	let i = 0;

	while (i < text.length - 1) {
		// Look for /* but not /**
		if (text[i] === '/' && text[i + 1] === '*' && (i + 2 >= text.length || text[i + 2] !== '*')) {
			const start = i;
			i += 2; // Skip past /*

			// Find matching */
			let depth = 1;
			let contentStart = i;
			let foundEnd = false;

			while (i < text.length - 1 && !foundEnd) {
				if (text[i] === '/' && text[i + 1] === '*') {
					// Nested /* - increase depth
					depth++;
					i += 2;
				} else if (text[i] === '*' && text[i + 1] === '/') {
					// Found */
					depth--;
					if (depth === 0) {
						// This closes our code block
						const end = i + 2; // Include */
						const content = text.substring(contentStart, i);
						codeBlocks.push({ start, end, content });
						foundEnd = true;
					}
					i += 2;
				} else {
					i++;
				}
			}

			// If we didn't find a closing */, skip to next potential start
			if (!foundEnd) {
				i = start + 1;
			}
		} else {
			i++;
		}
	}

	return codeBlocks;
};

/**
 * Parses a normalized comment string into basic tokens.
 * Detects paragraphs based on empty lines and continuation logic.
 * Also detects code blocks (pattern: slash-asterisk ... asterisk-slash).
 * @param normalizedComment - The normalized comment string.
 * @returns Array of tokens.
 */
const parseCommentToTokens = (
	normalizedComment: Readonly<string>,
): readonly CommentToken[] => {
	const lines = normalizedComment.split('\n');
	// Skip first line (/**) and last line (*/)
	if (lines.length <= INDEX_TWO) {
		return [];
	}
	const contentLines = lines.slice(INDEX_ONE, lines.length - INDEX_ONE);

	// Join content for code block detection
	const fullContent = contentLines.join('\n');

	// First detect /* ... */ code blocks using character scanning
	const codeBlocks = detectCodeBlocks(fullContent);

	// Detect paragraphs based on empty lines and sentence boundaries
	// Skip code blocks when detecting paragraphs
	const tokens: CommentToken[] = [];
	let currentParagraph: string[] = [];
	let currentParagraphLines: string[] = [];
	let currentPos = ARRAY_START_INDEX;

	for (let i = ARRAY_START_INDEX; i < contentLines.length; i++) {
		const line = contentLines[i] ?? '';
		const lineStartPos = currentPos;
		const lineEndPos = currentPos + line.length;
		currentPos = lineEndPos + INDEX_ONE; // +1 for newline

		// Check if this line is inside a code block - use Map for O(1) lookups
		let isInCodeBlock = false;
		let currentCodeBlock:
			| { start: number; end: number; content: string }
			| undefined;
		for (const cb of codeBlocks) {
			if (lineStartPos >= cb.start && lineEndPos <= cb.end) {
				isInCodeBlock = true;
				currentCodeBlock = cb;
				break;
			}
		}

		if (isInCodeBlock) {
			// Finish current paragraph if any, then handle code block
			if (currentParagraph.length > EMPTY) {
				tokens.push({
					type: 'paragraph',
					content: currentParagraph.join(' '),
					lines: currentParagraphLines,
					isContinuation: false,
				} satisfies ParagraphToken);
				currentParagraph = [];
				currentParagraphLines = [];
			}
			// Use cached code block from earlier check
			if (currentCodeBlock) {
				// Only add code block token once (on first line)
				const codeBlockStartLine = fullContent
					.substring(ARRAY_START_INDEX, currentCodeBlock.start)
					.split('\n').length;
				if (i === codeBlockStartLine) {
					tokens.push({
						type: 'code',
						startPos: currentCodeBlock.start,
						endPos: currentCodeBlock.end,
						rawCode: currentCodeBlock.content,
					} satisfies CodeBlockToken);
				}
			}
			continue;
		}

		// Remove comment prefix (*) to check if line is empty
		const trimmedLine = removeCommentPrefix(line);

		if (trimmedLine.length === EMPTY) {
			// Empty line - finish current paragraph if any
			if (currentParagraph.length > EMPTY) {
				tokens.push({
					type: 'paragraph',
					content: currentParagraph.join(' '),
					lines: currentParagraphLines,
					isContinuation: false,
				} satisfies ParagraphToken);
				currentParagraph = [];
				currentParagraphLines = [];
			}
			// Empty lines create paragraph boundaries but aren't tokens themselves
		} else {
			// Check if this line starts with @ (annotation)
			const isAnnotationLine = trimmedLine.startsWith('@');

			// Track code block state using token state instead of regex counting
			// Count {@code openings and } closings in current paragraph content
			// Cache current content to avoid repeated joins
			let codeBlockOpenCount = 0;
			let codeBlockCloseCount = 0;
			const currentContent = currentParagraph.join(' ');
			// Use simple string scanning instead of regex for better performance
			for (let j = 0; j < currentContent.length; j++) {
				if (currentContent.slice(j).startsWith('{@code')) {
					codeBlockOpenCount++;
					j += 6; // Skip past '{@code'
				} else if (currentContent[j] === '}') {
					codeBlockCloseCount++;
				}
			}
			const hasUnclosedCodeBlock =
				codeBlockOpenCount > codeBlockCloseCount;

			if (
				isAnnotationLine &&
				currentParagraph.length > EMPTY &&
				!hasUnclosedCodeBlock
			) {
				tokens.push({
					type: 'paragraph',
					content: currentParagraph.join(' '),
					lines: currentParagraphLines,
					isContinuation: false,
				} satisfies ParagraphToken);
				currentParagraph = [];
				currentParagraphLines = [];
			}

			// Check for sentence boundary: ends with sentence-ending punctuation
			// and next line starts with capital letter
			const trimmedEnd = trimmedLine.trimEnd();
			const endsWithSentencePunctuation =
				trimmedEnd.length > 0 &&
				(trimmedEnd.endsWith('.') ||
					trimmedEnd.endsWith('!') ||
					trimmedEnd.endsWith('?'));
			const nextLine = contentLines[i + INDEX_ONE];
			const nextTrimmed =
				nextLine !== undefined ? removeCommentPrefix(nextLine) : '';
			const nextStartsWithCapital =
				nextTrimmed.length > EMPTY &&
				nextTrimmed.charAt(0) >= 'A' &&
				nextTrimmed.charAt(0) <= 'Z';

			// Add current line to paragraph
			currentParagraph.push(trimmedLine);
			currentParagraphLines.push(line);

			// If this is a sentence boundary or we're at an annotation line, finish current paragraph
			if (
				(endsWithSentencePunctuation &&
					nextStartsWithCapital &&
					nextTrimmed.length > EMPTY) ||
				isAnnotationLine
			) {
				tokens.push({
					type: 'paragraph',
					content: currentParagraph.join(' '),
					lines: currentParagraphLines,
					isContinuation: false,
				} satisfies ParagraphToken);
				currentParagraph = [];
				currentParagraphLines = [];
			}
		}
	}

	// Add last paragraph if any
	if (currentParagraph.length > EMPTY) {
		tokens.push({
			type: 'paragraph',
			content: currentParagraph.join(' '),
			lines: currentParagraphLines,
			isContinuation: false,
		} satisfies ParagraphToken);
	}

	// If no paragraphs were found, create a single text token
	if (tokens.length === EMPTY) {
		const content = contentLines.join('\n');
		return [
			{
				type: 'text',
				content,
				lines: contentLines,
			} satisfies TextToken,
		];
	}

	return tokens;
};

/**
 * Converts tokens back to a formatted comment string.
 * Uses wrapped paragraphs if they've been wrapped.
 * @param tokens - Array of comment tokens.
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @returns The formatted comment string.
 *
 * Note: Currently handles string-based tokens. Future enhancement may support
 * Doc-based tokens using prettier.doc.printer.printDocToString for conversion.
 */
const tokensToCommentString = (
	tokens: readonly CommentToken[],
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): string => {
	const baseIndent = createIndent(
		commentIndent,
		options.tabWidth,
		options.useTabs,
	);
	const commentPrefix = `${baseIndent} * `;
	const lines: string[] = [`${baseIndent}/**`];

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;
		const isFollowedByCodeBlock = nextToken?.type === 'code';

		if (token.type === 'text') {
			// Filter out empty trailing lines if followed by a code block
			const linesToProcess = isFollowedByCodeBlock
				? (() => {
						const filtered = removeTrailingEmptyLines(token.lines);
						// Remove trailing newlines from the last line
						if (filtered.length > 0) {
							const lastIndex = filtered.length - 1;
							let lastLine = filtered[lastIndex];
							if (lastLine && lastLine.endsWith('\n')) {
								filtered[lastIndex] = lastLine.slice(0, -1);
							}
						}
						return filtered;
					})()
				: token.lines;

			for (const line of linesToProcess) {
				// Skip empty lines that would create a blank line before the code block
				if (isFollowedByCodeBlock && line.trim().length === 0) {
					continue;
				}
				// Preserve existing structure if line already has prefix
				if (line.trimStart().startsWith('*')) {
					lines.push(line);
				} else {
					lines.push(`${commentPrefix}${line.trimStart()}`);
				}
			}
		} else if (token.type === 'paragraph') {
			// Use wrapped lines if available, otherwise use original lines
			for (let j = 0; j < token.lines.length; j++) {
				let line = token.lines[j];
				const isLastLine = j === token.lines.length - 1;
				// Remove trailing newline from the last line of a paragraph token if it's followed by a code block
				// to avoid an extra blank line before the code block
				if (
					isLastLine &&
					isFollowedByCodeBlock &&
					line.endsWith('\n')
				) {
					line = line.slice(0, -1);
				}
				if (line.trimStart().startsWith('*')) {
					lines.push(line);
				} else {
					lines.push(`${commentPrefix}${line.trimStart()}`);
				}
			}
		} else if (token.type === 'code') {
			// Remove any trailing empty lines before adding the code block
			// to avoid an extra blank line before the code block
			// Keep at least one line (the opening /**)
			// Check up to the last 2 lines (in case there are multiple empty lines)
			for (
				let checkIndex = lines.length - 1;
				checkIndex > 0 && lines.length > 1;
				checkIndex--
			) {
				const lineToCheck = lines[checkIndex];
				if (lineToCheck && lineToCheck.trim().length === 0) {
					lines.splice(checkIndex, 1);
				} else {
					break; // Stop when we find a non-empty line
				}
			}

			// Use formatted code if available, otherwise use raw code
			const codeToUse = token.formattedCode ?? token.rawCode;
			// Handle empty code blocks - render {@code} even if content is empty
			const isEmptyBlock = codeToUse.trim().length === EMPTY;
			if (isEmptyBlock) {
				// Empty code block: render as {@code} on a single line
				lines.push(`${commentPrefix}{@code}`);
			} else if (codeToUse.length > EMPTY) {
				// Format code block with comment prefix
				// Split formatted code into lines and add prefix
				const codeLines = codeToUse.split('\n');
				for (const codeLine of codeLines) {
					if (codeLine.trim().length === EMPTY) {
						// Empty line - just comment prefix
						lines.push(commentPrefix.trimEnd());
					} else {
						lines.push(`${commentPrefix}${codeLine}`);
					}
				}
			}
		}
		// Annotation tokens will be handled later
	}

	lines.push(`${baseIndent} */`);
	return lines.join('\n');
};

/**
 * Wraps paragraph tokens based on effective page width.
 * Effective width accounts for comment prefix: printWidth - (baseIndent + ' * '.length)
 * @param tokens - Array of tokens (should be ParagraphTokens).
 * @param printWidth - The maximum line width.
 * @param baseIndent - The base indentation level in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @returns Array of wrapped paragraph tokens.
 */
const wrapParagraphTokens = (
	tokens: readonly CommentToken[],
	printWidth: number,
	baseIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): readonly ParagraphToken[] => {
	const commentPrefixLength = baseIndent + ' * '.length;
	const effectiveWidth = printWidth - commentPrefixLength;

	const wrappedTokens: ParagraphToken[] = [];

	for (const token of tokens) {
		if (token.type !== 'paragraph') {
			// For non-paragraph tokens, wrap them as-is (they'll be handled separately)
			continue;
		}

		// Use fill builder directly to get a Doc - split on whitespace characters manually
		const words: string[] = [];
		let currentWord = '';
		for (let i = 0; i < token.content.length; i++) {
			const char = token.content[i];
			if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
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
		const fillDoc = words.length > 0 ? prettier.doc.builders.fill(prettier.doc.builders.join(prettier.doc.builders.line, words)) : '';

		// Convert the fill Doc to string lines for compatibility with existing token structure
		const wrappedText = fillDoc ? prettier.doc.printer.printDocToString(fillDoc, {
			printWidth: effectiveWidth,
			tabWidth: options.tabWidth,
			useTabs: options.useTabs,
		}).formatted : '';
		const wrappedLines = wrappedText
			.split('\n')
			.filter((line) => line.trim().length > 0);

		// Create new paragraph token with wrapped lines
		// Need to reconstruct lines with comment prefix
		const baseIndentStr = createIndent(
			baseIndent,
			options.tabWidth,
			options.useTabs,
		);
		const commentPrefix = `${baseIndentStr} * `;
		const wrappedTokenLines = wrappedLines.map(
			(line) => `${commentPrefix}${line}`,
		);

		wrappedTokens.push({
			type: 'paragraph',
			content: wrappedLines.join(' '),
			lines: wrappedTokenLines,
			isContinuation: token.isContinuation,
		} satisfies ParagraphToken);
	}

	return wrappedTokens;
};

/**
 * Custom printComment function that preserves our wrapped lines.
 * The original printApexDocComment trims each line, which removes our carefully
 * calculated wrapping. This version preserves the line structure we created.
 * @param path - The AST path to the comment node.
 * @param _options - Parser options (unused but required by Prettier API).
 * @param _print - Print function (unused but required by Prettier API).
 * @param _originalPrintComment - Original print comment function (unused but required by Prettier API).
 * @param options - Parser options for processing.
 * @param getCurrentOriginalText - Function to get the original source text.
 * @param getFormattedCodeBlock - Function to get cached embed-formatted comments.
 * @returns The formatted comment as a Prettier Doc.
 */
const customPrintComment = (
	path: Readonly<AstPath<ApexNode>>,
	_options: Readonly<ParserOptions>,
	_print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	_originalPrintComment: (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	) => Doc,
	options: ParserOptions,
	_getCurrentOriginalText: () => string | undefined,
	_getFormattedCodeBlock: (key: string) => string | undefined,
	// eslint-disable-next-line @typescript-eslint/max-params -- Prettier printComment API requires parameters
): Doc => {
	const node = path.getNode();

	/**
	 * Check if this is an ApexDoc comment using the same logic as prettier-plugin-apex.
	 * But be more lenient: allow malformed comments (lines without asterisks) to be detected as ApexDoc
	 * if they start with / ** and end with * /.
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
		// Must start with /** and end with */
		if (
			!commentValue.trimStart().startsWith('/**') ||
			!commentValue.trimEnd().endsWith('*/')
		) {
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

	if (node !== null && 'value' in node && typeof node['value'] === 'string') {
		const commentNode = node as unknown as { value: string };
		const commentValue = commentNode.value;
		if (commentValue === '') return '';

		if (isApexDoc(node)) {
			// Check if there's a pre-formatted version from embed processing
			// Use the same cache key calculation as embed function
			const codeTagPos = commentValue.indexOf('{@code');
			const commentKey =
				codeTagPos !== -1
					? `${String(commentValue.length)}-${String(codeTagPos)}`
					: null;
			const embedFormattedComment = commentKey
				? _getFormattedCodeBlock(commentKey)
				: null;
			// Use embed-formatted comment if available, otherwise normalize the original comment
			// Normalize the embed-formatted comment to match Prettier's indentation (single space before *)
			const commentToUse = embedFormattedComment
				? normalizeSingleApexDocComment(
						embedFormattedComment,
						0,
						options,
					)
				: normalizeSingleApexDocComment(commentValue, 0, options);

			// Return the comment as Prettier documents
			const lines = commentToUse.split('\n');
			const { fill, join, hardline } = prettier.doc.builders;
			return [join(hardline, lines)];
		} else {
			// Check if this is an inline comment (starts with //)
			// Inline comments should be passed through unchanged, like the reference implementation
			const isInlineComment = commentValue.trim().startsWith('//');
			if (isInlineComment) {
				// Return inline comment as-is (no normalization needed)
				return commentValue;
			}

			// Non-ApexDoc block comments: normalize annotations in text
			// Parse to tokens, normalize annotations, then convert back
			const tokens = parseCommentToTokens(commentValue);
			const normalizedTokens = normalizeAnnotationTokens(tokens);
			const normalizedComment = tokensToCommentString(
				normalizedTokens,
				0,
				{
					tabWidth: options.tabWidth,
					useTabs: options.useTabs,
				},
			);

			// Return the normalized comment as Prettier documents
			const lines = normalizedComment.split('\n');
			const { fill, join, hardline } = prettier.doc.builders;
			return [join(hardline, lines)];
		}
	}

	return '';
};

/**
 * Handles comments that are on their own line.
 * This is called by Prettier's comment handling code.
 * @param _comment - The comment node (unused in stub).
 * @param _sourceCode - The entire source code (unused in stub).
 * @returns False to let Prettier handle the comment with its default logic.
 */
const handleOwnLineComment = (
	comment: unknown,
	_sourceCode: string,
): boolean => {
	return (
		handleDanglingComment(comment) ||
		handleBlockStatementLeadingComment(comment)
	);
};

/**
 * Handles comments that have preceding text but no trailing text on a line.
 * This is called by Prettier's comment handling code.
 * @param _comment - The comment node (unused in stub).
 * @param _sourceCode - The entire source code (unused in stub).
 * @returns False to let Prettier handle the comment with its default logic.
 */
const handleEndOfLineComment = (
	comment: unknown,
	_sourceCode: string,
): boolean => {
	return (
		handleDanglingComment(comment) ||
		handleBinaryExpressionTrailingComment(comment) ||
		handleBlockStatementLeadingComment(comment)
	);
};

/**
 * Handles comments that have both preceding text and trailing text on a line.
 * This is called by Prettier's comment handling code.
 * @param _comment - The comment node (unused in stub).
 * @param _sourceCode - The entire source code (unused in stub).
 * @returns False to let Prettier handle the comment with its default logic.
 */
const handleRemainingComment = (
	comment: unknown,
	_sourceCode: string,
): boolean => {
	return (
		handleDanglingComment(comment) ||
		handleBlockStatementLeadingComment(comment)
	);
};

export {
	getIndentLevel,
	createIndent,
	getCommentIndent,
	normalizeBlockComment,
	parseCommentToTokens,
	tokensToCommentString,
	wrapParagraphTokens,
	customPrintComment,
	isMalformedCommentBlock,
	removeCommentPrefix,
	handleOwnLineComment,
	handleEndOfLineComment,
	handleRemainingComment,
	ARRAY_START_INDEX,
	DEFAULT_TAB_WIDTH,
	INDEX_ONE,
	INDEX_TWO,
	STRING_OFFSET,
	MIN_INDENT_LEVEL,
	EMPTY,
	NOT_FOUND_INDEX,
};
export type {
	TextToken,
	CodeBlockToken,
	AnnotationToken,
	ParagraphToken,
	CommentToken,
};
