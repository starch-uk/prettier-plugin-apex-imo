/**
 * @file Utility functions for finding and processing ApexDoc comments and their indentation.
 */

import type { ParserOptions } from 'prettier';
import type { AstPath, Doc } from 'prettier';
import * as prettier from 'prettier';
import type { ApexNode } from './types.js';
import {
	ARRAY_START_INDEX,
	docBuilders,
	EMPTY,
	getNodeClassOptional,
	INDEX_ONE,
	STRING_OFFSET,
	isEmpty,
	isNotEmpty,
	isObject,
} from './utils.js';
import {
	normalizeSingleApexDocComment,
	removeTrailingEmptyLines,
	isApexDoc,
} from './apexdoc.js';
import { normalizeAnnotations } from './apexdoc-annotations.js';

// Doc-based types for ApexDoc processing
interface ApexDocContent {
	readonly type: 'paragraph' | 'text';

	/**
	 * Doc representation of the content.
	 * This should NOT include any leading comment prefix (`*`, whitespace).
	 * For paragraphs, this is typically `join(hardline, lines)`.
	 */
	readonly content: Doc;

	/**
	 * Per-line Docs for this content, without comment prefix.
	 * Consumers that need to reason about individual lines (e.g. Wrapping)
	 * should use this instead of re-splitting strings.
	 */
	readonly lines: readonly Doc[];
	readonly isContinuation: boolean | undefined;
}

interface ApexDocCodeBlock {
	readonly type: 'code';
	readonly startPos: number;
	readonly endPos: number;

	/**
	 * Raw code string between {@code ... } braces, with comment prefixes removed.
	 * This is kept for interaction with prettier.format and other string-based helpers.
	 */
	readonly rawCode: string;

	/**
	 * Optional formatted code string as returned from the embed / formatter pipeline.
	 * When present, this is the canonical string representation of the code block.
	 */
	readonly formattedCode?: string;

	/**
	 * Doc representation of the final code block content, without comment prefix.
	 * This is typically built as `join(hardline, codeLines)`.
	 */
	readonly content: Doc;
}

interface ApexDocAnnotation {
	readonly type: 'annotation';
	readonly name: string;

	/**
	 * Doc representation of the annotation body (everything after the name).
	 * This may contain hardlines for wrapped content.
	 */
	readonly content: Doc;

	/**
	 * Optional Doc that should appear immediately before the annotation
	 * on its own line (used for leading summary text).
	 */
	readonly followingText?: Doc;
}

type ApexDocComment = ApexDocAnnotation | ApexDocCodeBlock | ApexDocContent;

const MIN_INDENT_LEVEL = 0;
const DEFAULT_TAB_WIDTH = 2;
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
	if (!isObject(comment)) return false;

	const commentWithContext = comment as {
		enclosingNode?: ApexNode;
		'@class'?: string;
	};

	const { enclosingNode } = commentWithContext;
	if (!enclosingNode) return false;
	const enclosingNodeClass = getNodeClassOptional(enclosingNode);
	if (
		!enclosingNodeClass ||
		!ALLOW_DANGLING_COMMENTS.includes(enclosingNodeClass)
	) {
		return false;
	}
	const enclosingNodeWithMembers = enclosingNode as {
		stmnts?: unknown[];
		members?: unknown[];
	};
	const isEmpty =
		enclosingNodeWithMembers.stmnts?.length === 0 ||
		enclosingNodeWithMembers.members?.length === 0;
	if (!isEmpty) return false;
	const { addDanglingComment } = prettier.util;
	addDanglingComment(enclosingNode, comment, null);
	return true;
};

/**
 * Handles leading comments before block statements.
 * Moves leading comments before block statements into the block itself for better formatting.
 * @param comment - The comment node to handle.
 * @returns True if the comment was handled, false otherwise.
 */
const handleBlockStatementLeadingComment = (comment: unknown): boolean => {
	if (!isObject(comment)) return false;

	const commentWithContext = comment as {
		followingNode?: ApexNode;
		'@class'?: string;
	};

	const { followingNode } = commentWithContext;
	if (!followingNode) return false;
	const followingNodeClass = getNodeClassOptional(followingNode);
	if (followingNodeClass !== 'apex.jorje.data.ast.Stmnt$BlockStmnt') {
		return false;
	}

	const blockStatement = followingNode as { stmnts?: unknown[] };
	const { addLeadingComment, addDanglingComment } = prettier.util;

	const hasStatements =
		blockStatement.stmnts !== undefined &&
		blockStatement.stmnts.length > 0;
	if (hasStatements) {
		// Add as leading comment to first statement in block
		addLeadingComment(blockStatement.stmnts[0], comment);
	} else {
		// Add as dangling comment to empty block (stmnts is undefined or empty array)
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
const handleBinaryishExpressionRightChildTrailingComment = (
	comment: unknown,
): boolean => {
	if (!isObject(comment)) return false;

	const commentWithContext = comment as {
		precedingNode?: ApexNode;
		placement?: string;
		'@class'?: string;
	};

	const { precedingNode, placement } = commentWithContext;
	if (placement !== 'endOfLine' || !precedingNode) return false;
	const precedingNodeClass = getNodeClassOptional(precedingNode);
	const BINARY_EXPR_CLASS = 'apex.jorje.data.ast.Expr$BinaryExpr';
	const BOOLEAN_EXPR_CLASS = 'apex.jorje.data.ast.Expr$BooleanExpr';
	if (
		precedingNodeClass !== BINARY_EXPR_CLASS &&
		precedingNodeClass !== BOOLEAN_EXPR_CLASS
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
	// prettier.util.getIndentSize requires a newline to work correctly
	// It calculates the indent of the last line in a multi-line string
	// So we prepend a newline to make it work with single lines
	return prettier.util.getIndentSize(`\n${line}`, tabWidth);
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

const getCommentIndent = (
	text: Readonly<string>,
	commentStart: number,
): number => {
	// Since commentStart is at / in /**, we know text[commentStart + 1] is *
	// skipToLineEnd returns commentStart, and skipNewline doesn't advance past it,
	// so we can always find the * at commentStart + 1
	const asteriskInCommentStart = commentStart + STRING_OFFSET;
	// Find line start by scanning backwards for newline
	let lineStart = asteriskInCommentStart;
	while (
		lineStart > ARRAY_START_INDEX &&
		text[lineStart - STRING_OFFSET] !== '\n'
	)
		lineStart--;
	return getIndentLevel(
		text.substring(lineStart, asteriskInCommentStart),
		DEFAULT_TAB_WIDTH,
	);
};

/**
 * Normalizes comment start marker: /***** -> /**.
 * @param comment
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
		if (asteriskCount !== 2) {
			return prefix + '/**' + afterSlash.substring(asteriskCount);
		}
	}
	return comment;
};

/**
 * Normalizes comment end marker: multiple asterisks before slash to single asterisk.
 * @param comment
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
 * @param line
 * @param baseIndent
 * @param isFirstOrLast
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
		const char = line[i];
		if (char === ' ' || char === '\t') continue;
		if (char === '*') {
			asteriskPos = i;
			break;
		}
		break;
	}

	if (asteriskPos === -1) {
		// asteriskPos === -1 means no asterisk found after whitespace
		// so trimmed cannot start with '*' (would have been found by loop)
		const trimmed = line.trimStart();
		return `${baseIndent} * ${trimmed}`;
	}

	// Found asterisk - normalize
	let afterAsterisk = line.substring(asteriskPos + 1);
	// Skip multiple asterisks and whitespace
	while (afterAsterisk.startsWith('*')) {
		afterAsterisk = afterAsterisk.substring(1);
	}
	// Count leading whitespace using character scanning (replaces regex /^\s*/)
	let leadingWhitespaceCount = 0;
	while (
		leadingWhitespaceCount < afterAsterisk.length &&
		(afterAsterisk[leadingWhitespaceCount] === ' ' ||
			afterAsterisk[leadingWhitespaceCount] === '\t')
	) {
		leadingWhitespaceCount++;
	}
	const spaceAfterAsterisk = afterAsterisk.substring(
		0,
		leadingWhitespaceCount,
	);
	// Remove first space if present, preserve additional spaces (code indentation)
	afterAsterisk =
		spaceAfterAsterisk.length > EMPTY
			? afterAsterisk.substring(1)
			: afterAsterisk.trimStart();
	// Remove any remaining asterisks at start of content
	while (afterAsterisk.startsWith('*')) {
		afterAsterisk = afterAsterisk.substring(1).trimStart();
	}
	return `${baseIndent} * ${afterAsterisk}`;
};

/**
 * Normalizes a block comment to standard format.
 * Handles malformed comments by normalizing markers, asterisks, and indentation.
 * Uses unified token processing for consistent formatting.
 * @param commentValue - The comment text (e.g., comment block).
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth, useTabs, and printWidth.
 * @returns The normalized comment value.
 */
const normalizeBlockComment = (
	commentValue: Readonly<string>,
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
		readonly printWidth?: number;
	}>,
): string => {
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
		const line = lines[i];
		if (line === undefined) continue;
		normalizedLines.push(
			normalizeCommentLine(
				line,
				baseIndent,
				i === ARRAY_START_INDEX || i === lines.length - INDEX_ONE,
			),
		);
	}
	return normalizedLines.join('\n');
};

const NOT_FOUND_INDEX = -1;

/**
 * Comment prefix utilities for consistent handling of comment formatting.
 */
const CommentPrefix = {
	/**
	 * Creates a comment prefix string for a given indentation level.
	 * @param indentLevel - The indentation level in spaces.
	 * @param options - Options including tabWidth and useTabs.
	 * @returns The comment prefix string (e.g., "  * ").
	 */
	create: (
		indentLevel: number,
		options: Readonly<{
			readonly tabWidth: number;
			readonly useTabs?: boolean | null | undefined;
		}>,
	): string => {
		const baseIndent = createIndent(
			indentLevel,
			options.tabWidth,
			options.useTabs,
		);
		return `${baseIndent} * `;
	},

	/**
	 * Gets the length of a comment prefix for a given indentation level.
	 * @param indentLevel - The indentation level in spaces.
	 * @returns The length of the comment prefix.
	 */
	getLength: (indentLevel: number): number => {
		return indentLevel + ' * '.length;
	},
};

/**
 * Removes comment prefix (asterisk and spaces) from a line.
 * @param line - Line to remove prefix from.
 * @param preserveIndent - If true, only removes asterisk and single space after it to preserve code indentation. Otherwise removes all prefix and trims.
 * @returns Line with prefix removed and optionally trimmed.
 */
const removeCommentPrefix = (
	line: string,
	preserveIndent = false,
): string => {
	if (preserveIndent) {
		// Remove all asterisks (including multiple asterisks separated by spaces) and single space after, preserving indentation
		// Pattern: leading whitespace + asterisk(s) (with optional spaces between) + optional single space + rest
		// We want to remove: leading whitespace + all asterisks (including * * * patterns) + exactly one space (if present)
		// But preserve: any additional spaces after that (indentation) and the content
		// Match: leading whitespace, then asterisks (possibly separated by spaces), then optional single space, then rest
		const match = /^(\s*)(\*(\s*\*)*)\s?(.*)$/.exec(line);
		if (match) {
			// match[4] is capturing group (.*) which always matches (even if empty string)
			// so rest will always be a string, never undefined
			const rest = match[4] ?? '';
			// Remove leading whitespace and all asterisks, preserve the rest (which may have indentation spaces)
			// If rest starts with exactly one space, that's the space after the asterisk(s) - remove it
			// But preserve any additional spaces (indentation) - they're part of the content
			// Check if rest starts with a single space followed by non-space (normal case)
			// or multiple spaces (indentation case) - using character scanning instead of regex
			const trimmed = rest.trimStart();
			if (trimmed.length < rest.length) {
				const spaces = rest.slice(0, rest.length - trimmed.length);
				const content = trimmed;
				// If exactly one space, remove it (it's the separator after asterisk)
				// If multiple spaces, keep them (they're indentation)
				if (spaces.length === 1) {
					return content;
				}
				// Multiple spaces - preserve as indentation
				return rest;
			}
			// No leading space - return as-is
			return rest;
		}
		return line;
	}
	// Use original regex: /^\s*(\*(\s*\*)*)\s*/ - removes leading whitespace, asterisk(s), and all trailing whitespace
	const result = line.replace(/^\s*(\*(\s*\*)*)\s*/, '');
	return result.trim();
};


/**
 * Converts string lines to Doc array (strings are valid Docs).
 * @param lines
 */
const linesToDocLines = (lines: readonly string[]): readonly Doc[] =>
	lines.map((line) => line as Doc);

/**
 * Converts string content to Doc (string is a valid Doc).
 * For multi-line content, joins with hardline.
 * @param _content
 * @param lines
 */
const contentToDoc = (_content: string, lines: readonly string[]): Doc => {
	const { join, hardline } = docBuilders;
	if (lines.length === 0) {
		return '' as Doc;
	}
	if (lines.length === 1) {
		return lines[0] as Doc;
	}
	return join(hardline, [...linesToDocLines(lines)]);
};

/**
 * Extracts string content from a Doc for text operations.
 * If Doc is a string, returns it. Otherwise, prints it to string.
 * @param doc
 * @param options
 * @param options.printWidth
 */
const docToString = (doc: Doc, options?: { printWidth?: number }): string => {
	if (typeof doc === 'string') {
		return doc;
	}
	// For complex Docs, print to string
	return prettier.doc.printer.printDocToString(doc, {
		printWidth: options?.printWidth ?? 80,
		tabWidth: 2,
	}).formatted;
};

/**
 * Extracts string content from ApexDocContent for text operations.
 * @param doc
 */
const getContentString = (doc: ApexDocContent): string =>
	docToString(doc.content);

/**
 * Extracts string lines from ApexDocContent for text operations.
 * @param doc
 */
const getContentLines = (doc: ApexDocContent): readonly string[] =>
	doc.lines.map((line) => docToString(line));

/**
 * Creates an ApexDocContent from string content and lines.
 * @param type
 * @param content
 * @param lines
 * @param isContinuation
 */
const createDocContent = (
	type: 'paragraph' | 'text',
	content: string,
	lines: readonly string[],
	isContinuation?: boolean,
): ApexDocContent => {
	// Preserve lines as-is - comment prefix and indentation will be handled later when needed
	// This preserves code block indentation that would be lost if we strip prefixes here
	const trimmedLines = lines;
	return {
		content: contentToDoc(content, trimmedLines),
		isContinuation,
		lines: linesToDocLines(trimmedLines),
		type,
	};
};

/**
 * Parses a normalized comment string into Doc-based tokens.
 * Detects paragraphs based on empty lines and continuation logic.
 * Also detects code blocks (pattern: slash-asterisk ... Asterisk-slash).
 * @param normalizedComment - The normalized comment string.
 * @returns Array of Doc-based tokens.
 */
const parseCommentToDocs = (
	normalizedComment: Readonly<string>,
): readonly ApexDocComment[] => {
	const lines = normalizedComment.split('\n');
	// Skip first line (/**) and last line (*/)
	if (lines.length <= INDEX_TWO) {
		return [];
	}
	const contentLines = lines.slice(INDEX_ONE, lines.length - INDEX_ONE);

	// Detect paragraphs based on empty lines and sentence boundaries
	// Note: Code block detection for /* ... */ patterns is removed because
	// Apex doesn't support nested block comments, so detectCodeBlocks would
	// never find valid patterns in parsed comment content.
	const docs: ApexDocComment[] = [];
	let currentParagraph: string[] = [];
	let currentParagraphLines: string[] = [];

	const finishParagraph = (): void => {
		if (currentParagraph.length > EMPTY) {
			const paragraphContent = currentParagraph.join(' ');
			docs.push(
				createDocContent(
					'paragraph',
					paragraphContent,
					currentParagraphLines,
				),
			);
			currentParagraph = [];
			currentParagraphLines = [];
		}
	};

	for (let i = ARRAY_START_INDEX; i < contentLines.length; i++) {
		const line = contentLines[i];
		if (line === undefined) continue;

		// Remove comment prefix (*) to check if line is empty
		const trimmedLine = removeCommentPrefix(line);

		if (isEmpty(trimmedLine)) {
			// Empty line - finish current paragraph if any
			finishParagraph();
			// Empty lines create paragraph boundaries but aren't docs themselves
		} else {
			// Check if this line starts with @ (annotation)
			const isAnnotationLine = trimmedLine.startsWith('@');

			// Track code block state using doc state instead of regex counting
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
				finishParagraph();
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
				isNotEmpty(nextTrimmed) &&
				nextTrimmed.charAt(0) >= 'A' &&
				nextTrimmed.charAt(0) <= 'Z';

			// Add current line to paragraph
			currentParagraph.push(trimmedLine);
			currentParagraphLines.push(line);

			// If this is a sentence boundary or we're at an annotation line, finish current paragraph
			if (
				(endsWithSentencePunctuation &&
					nextStartsWithCapital &&
					isNotEmpty(nextTrimmed)) ||
				isAnnotationLine
			) {
				finishParagraph();
			}
		}
	}

	// Add last paragraph if any
	finishParagraph();

	// If no paragraphs were found, create a single text doc
	if (isEmpty(docs)) {
		const content = contentLines
			.map((line) => removeCommentPrefix(line))
			.join('\n');
		const trimmedLines = contentLines.map((line) =>
			removeCommentPrefix(line),
		);
		return [createDocContent('text', content, trimmedLines)];
	}

	return docs;
};

/**
 * Converts Doc tokens back to a formatted comment string.
 * Uses wrapped paragraphs if they've been wrapped.
 * @param tokens - Array of Doc-based comment tokens.
 * @param docs
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @returns The formatted comment string.
 */
const tokensToCommentString = (
	docs: readonly ApexDocComment[],
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): string => {
	const commentPrefix = CommentPrefix.create(commentIndent, options);
	const baseIndent = createIndent(
		commentIndent,
		options.tabWidth,
		options.useTabs,
	);
	const lines: string[] = [`${baseIndent}/**`];

	for (let i = 0; i < docs.length; i++) {
		const doc = docs[i];
		if (!doc) continue;

		if (doc.type === 'text' || doc.type === 'paragraph') {
			// Extract string lines from Doc
			const docLines = getContentLines(doc);

			for (const line of docLines) {
				// Preserve existing structure if line already has prefix
				lines.push(
					line.trimStart().startsWith('*')
						? line
						: `${commentPrefix}${line.trimStart()}`,
				);
			}
		}
		// Annotation docs will be handled later
		// Note: Code block docs are converted to content docs in docsToApexDocString
		// before reaching tokensToCommentString, so doc.type === 'code' and isFollowedByCodeBlock are unreachable
	}

	lines.push(`${baseIndent} */`);
	return lines.join('\n');
};

/**
 * Unified async text wrapping utility that provides consistent wrapping behavior.
 * Used by both token processing and direct content wrapping to ensure uniform results.
 * Splits text into words and wraps using Prettier's fill builder with proper width constraints.
 * @param textContent - The text content to wrap.
 * @param effectiveWidth - The effective width available for content.
 * @param options - Options including tabWidth and useTabs.
 * @returns Array of wrapped lines.
 */
const wrapTextToWidth = (
	textContent: string,
	effectiveWidth: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): string[] => {
	if (textContent.length <= effectiveWidth) {
		// Content fits, return as single line
		return [textContent];
	}

	// Use fill builder to wrap content - split on whitespace
	const words = textContent.split(/\s+/).filter((word) => isNotEmpty(word));
	if (isEmpty(words)) return [textContent];

	const { fill, join: joinBuilders, line } = docBuilders;
	const fillDoc = fill(joinBuilders(line, words));
	const useTabsOption =
		options.useTabs !== null && options.useTabs !== undefined
			? { useTabs: options.useTabs }
			: {};
	const wrappedText = prettier.doc.printer.printDocToString(fillDoc, {
		printWidth: effectiveWidth,
		tabWidth: options.tabWidth,
		...useTabsOption,
	}).formatted;
	return wrappedText.split('\n').filter((line) => isNotEmpty(line.trim()));
};

/**
 * PrintComment function that preserves our wrapped lines.
 * The original printApexDocComment trims each line, which removes our carefully
 * calculated wrapping. This version preserves the line structure we created.
 * @param path - The AST path to the comment node.
 * @param _options - Parser options (unused but required by Prettier API).
 * @param _print - Print function (unused but required by Prettier API).
 * @param _originalPrintComment - Original print comment function (unused but required by Prettier API).
 * @param options - Parser options for processing.
 * @param getCurrentOriginalText - Function to get the original source text.
 * @param getFormattedCodeBlock - Function to get cached embed-formatted comments.
 * @param _getCurrentOriginalText
 * @param _getFormattedCodeBlock
 * @returns The formatted comment as a Prettier Doc.
 */
const printComment = (
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
			// Pass isEmbedFormatted=true to preserve formatted code from embed function
			const commentDoc = embedFormattedComment
				? normalizeSingleApexDocComment(
						embedFormattedComment,
						0,
						options,
						true,
					)
				: normalizeSingleApexDocComment(
						commentValue,
						0,
						options,
						false,
					);

			// Return the comment as Prettier documents (already in Doc format)
			return [commentDoc];
		} else {
			// Check if this is an inline comment (starts with //)
			// Inline comments should be passed through unchanged, like the reference implementation
			const isInlineComment = commentValue.trim().startsWith('//');
			if (isInlineComment) {
				// Return inline comment as-is (no normalization needed)
				return commentValue;
			}

			// Non-ApexDoc block comments: normalize annotations in text
			// Parse to docs, normalize annotations, then convert back
			const docs = parseCommentToDocs(commentValue);
			const normalizedDocs = normalizeAnnotations(docs);
			const normalizedComment = tokensToCommentString(normalizedDocs, 0, {
				tabWidth: options.tabWidth,
				useTabs: options.useTabs,
			});

			// Return the normalized comment as Prettier documents
			const lines = normalizedComment.split('\n');
			const { join, hardline } = docBuilders;
			return [join(hardline, lines)];
		}
	}

	return '';
};

/**
 * Tries handlers in order until one returns true.
 * @param comment
 * @param handlers
 */
const tryHandlers = (
	comment: unknown,
	handlers: readonly ((comment: unknown) => boolean)[],
): boolean => {
	for (const handler of handlers) {
		if (handler(comment)) return true;
	}
	return false;
};

/**
 * Handles comments that are on their own line.
 * This is called by Prettier's comment handling code.
 * @param comment - The comment node.
 * @param _sourceCode - The entire source code (unused).
 * @returns False to let Prettier handle the comment with its default logic.
 */
const handleOwnLineComment = (comment: unknown, _sourceCode: string): boolean =>
	tryHandlers(comment, [
		handleDanglingComment,
		handleBlockStatementLeadingComment,
	]);

/**
 * Handles comments that have preceding text but no trailing text on a line.
 * This is called by Prettier's comment handling code.
 * @param comment - The comment node.
 * @param _sourceCode - The entire source code (unused).
 * @returns False to let Prettier handle the comment with its default logic.
 */
const handleEndOfLineComment = (
	comment: unknown,
	_sourceCode: string,
): boolean =>
	tryHandlers(comment, [
		handleDanglingComment,
		handleBinaryishExpressionRightChildTrailingComment,
		handleBlockStatementLeadingComment,
	]);

/**
 * Handles comments that have both preceding text and trailing text on a line.
 * This is called by Prettier's comment handling code.
 * @param comment - The comment node.
 * @param _sourceCode - The entire source code (unused).
 * @returns False to let Prettier handle the comment with its default logic.
 */
const handleRemainingComment = (
	comment: unknown,
	_sourceCode: string,
): boolean =>
	tryHandlers(comment, [
		handleDanglingComment,
		handleBlockStatementLeadingComment,
	]);

export {
	getIndentLevel,
	createIndent,
	getCommentIndent,
	normalizeBlockComment,
	parseCommentToDocs,
	tokensToCommentString,
	wrapTextToWidth,
	CommentPrefix,
	printComment,
	removeCommentPrefix,
	handleOwnLineComment,
	handleEndOfLineComment,
	handleRemainingComment,
	DEFAULT_TAB_WIDTH,
	INDEX_TWO,
	MIN_INDENT_LEVEL,
	NOT_FOUND_INDEX,
	docToString,
	getContentString,
	getContentLines,
	createDocContent,
};
export type {
	// Doc-based types for ApexDoc processing
	ApexDocContent,
	ApexDocCodeBlock,
	ApexDocAnnotation,
	ApexDocComment,
};
