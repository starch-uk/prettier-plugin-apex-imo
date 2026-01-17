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
import { normalizeSingleApexDocComment, isApexDoc } from './apexdoc.js';
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
	 * Raw code string between code tag braces, with comment prefixes removed.
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

/* eslint-disable @typescript-eslint/no-type-alias -- Union type needed for type discrimination */
type ApexDocComment = ApexDocAnnotation | ApexDocCodeBlock | ApexDocContent;
/* eslint-enable @typescript-eslint/no-type-alias */

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
	const hasValidClass =
		enclosingNodeClass !== undefined &&
		ALLOW_DANGLING_COMMENTS.includes(enclosingNodeClass);
	if (!hasValidClass) {
		return false;
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- enclosingNode is confirmed to have members
	const enclosingNodeWithMembers = enclosingNode as {
		stmnts?: unknown[];
		members?: unknown[];
	};
	const ZERO_LENGTH = 0;
	const NOT_FOUND_LENGTH = -1;
	const stmntsLength =
		enclosingNodeWithMembers.stmnts?.length ?? NOT_FOUND_LENGTH;
	const membersLength =
		enclosingNodeWithMembers.members?.length ?? NOT_FOUND_LENGTH;
	const isEmptyCheck =
		stmntsLength === ZERO_LENGTH || membersLength === ZERO_LENGTH;
	if (!isEmptyCheck) return false;
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

	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- followingNode is confirmed to be BlockStmnt
	const blockStatement = followingNode as { stmnts?: unknown[] };
	const { addLeadingComment, addDanglingComment } = prettier.util;

	const ZERO_LENGTH = 0;
	const FIRST_STMT_INDEX = 0;
	const hasStatements =
		blockStatement.stmnts !== undefined &&
		blockStatement.stmnts.length > ZERO_LENGTH;
	const firstStmt = hasStatements
		? blockStatement.stmnts?.[FIRST_STMT_INDEX]
		: undefined;
	if (hasStatements && firstStmt !== undefined && firstStmt !== null) {
		// Add as leading comment to first statement in block
		addLeadingComment(firstStmt, comment);
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

	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- precedingNode is confirmed to be BinaryExpr or BooleanExpr
	const binaryExpr = precedingNode as { right?: unknown };
	const hasRight =
		binaryExpr.right !== undefined && binaryExpr.right !== null;
	if (!hasRight) return false;

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
 * @param comment - The comment string to normalize.
 * @returns The normalized comment string with exactly two asterisks at the start.
 */
const normalizeCommentStart = (comment: string): string => {
	const ZERO_INDEX = 0;
	const SINGLE_OFFSET = 1;
	const REQUIRED_ASTERISK_COUNT = 2;
	// Find first non-whitespace character
	let start = ZERO_INDEX;
	while (
		start < comment.length &&
		(comment[start] === ' ' || comment[start] === '\t')
	) {
		start++;
	}
	// Block comments always start with /* or /** after whitespace
	// Normalize multiple asterisks to exactly two asterisks (/**)
	const prefix = comment.substring(ZERO_INDEX, start);
	const afterSlash = comment.substring(start + SINGLE_OFFSET);
	// Count asterisks after /
	let asteriskCount = ZERO_INDEX;
	while (
		asteriskCount < afterSlash.length &&
		afterSlash[asteriskCount] === '*'
	) {
		asteriskCount++;
	}
	// Normalize to exactly two asterisks (/**)
	if (asteriskCount !== REQUIRED_ASTERISK_COUNT) {
		return prefix + '/**' + afterSlash.substring(asteriskCount);
	}
	return comment;
};

/**
 * Normalizes comment end marker: multiple asterisks before slash to single asterisk.
 * @param comment - The comment string to normalize.
 * @returns The normalized comment string with single asterisk before closing slash.
 */
const normalizeCommentEnd = (comment: string): string => {
	// Replace **/ or more with */ - scan for patterns and replace
	let result = comment;
	const ZERO_INDEX = 0;
	const SINGLE_OFFSET = 1;
	const MIN_ASTERISK_COUNT = 2;
	const SLASH_OFFSET = 2;
	let pos = ZERO_INDEX;
	while (pos < result.length) {
		// Look for */ pattern
		const slashPos = result.indexOf('/', pos);
		const NOT_FOUND = -1;
		if (slashPos === NOT_FOUND) break;

		// Count asterisks before /
		let asteriskCount = ZERO_INDEX;
		let checkPos = slashPos - SINGLE_OFFSET;
		while (checkPos >= ZERO_INDEX && result[checkPos] === '*') {
			asteriskCount++;
			checkPos--;
		}

		// If we have 2+ asterisks before /, normalize to */
		if (asteriskCount >= MIN_ASTERISK_COUNT) {
			const replaceStart = checkPos + SINGLE_OFFSET;
			result =
				result.substring(ZERO_INDEX, replaceStart) +
				'*/' +
				result.substring(slashPos + SINGLE_OFFSET);
			pos = replaceStart + SLASH_OFFSET;
		} else {
			pos = slashPos + SINGLE_OFFSET;
		}
	}
	return result;
};

/**
 * Normalizes a single comment line with asterisk prefix.
 * @param line - The comment line to normalize.
 * @param baseIndent - The base indentation string.
 * @param isFirstOrLast - Whether this is the first or last line of the comment.
 * @returns The normalized comment line.
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
	const NOT_FOUND_POS = -1;
	const ZERO_INDEX = 0;
	const SINGLE_OFFSET = 1;
	let asteriskPos = NOT_FOUND_POS;
	for (let i = ZERO_INDEX; i < line.length; i++) {
		const char = line[i];
		if (char === ' ' || char === '\t') continue;
		if (char === '*') {
			asteriskPos = i;
			break;
		}
		break;
	}

	if (asteriskPos === NOT_FOUND_POS) {
		// asteriskPos === -1 means no asterisk found after whitespace
		// so trimmed cannot start with '*' (would have been found by loop)
		const trimmed = line.trimStart();
		return `${baseIndent} * ${trimmed}`;
	}

	// Found asterisk - normalize
	let afterAsterisk = line.substring(asteriskPos + SINGLE_OFFSET);
	// Skip multiple asterisks and whitespace
	while (afterAsterisk.startsWith('*')) {
		afterAsterisk = afterAsterisk.substring(SINGLE_OFFSET);
	}
	// Count leading whitespace using character scanning (replaces regex /^\s*/)
	let leadingWhitespaceCount = ZERO_INDEX;
	while (
		leadingWhitespaceCount < afterAsterisk.length &&
		(afterAsterisk[leadingWhitespaceCount] === ' ' ||
			afterAsterisk[leadingWhitespaceCount] === '\t')
	) {
		leadingWhitespaceCount++;
	}
	const spaceAfterAsterisk = afterAsterisk.substring(
		ZERO_INDEX,
		leadingWhitespaceCount,
	);
	// Remove first space if present, preserve additional spaces (code indentation)
	afterAsterisk =
		spaceAfterAsterisk.length > EMPTY
			? afterAsterisk.substring(SINGLE_OFFSET)
			: afterAsterisk.trimStart();
	// Remove any remaining asterisks at start of content
	while (afterAsterisk.startsWith('*')) {
		afterAsterisk = afterAsterisk.substring(SINGLE_OFFSET).trimStart();
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
	// lines comes from normalizedComment.split('\n') which never creates undefined entries
	// Array indexing check removed: lines array has no holes
	for (let i = ARRAY_START_INDEX; i < lines.length; i++) {
		const line = lines[i];
		// Type assertion safe: line is never undefined per array iteration guarantee
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
		/** ' * '.length. */
		const COMMENT_PREFIX_LENGTH = 4;
		return indentLevel + COMMENT_PREFIX_LENGTH;
	},
};

/**
 * Removes comment prefix (asterisk and spaces) from a line.
 * @param line - Line to remove prefix from.
 * @param preserveIndent - If true, only removes asterisk and single space after it to preserve code indentation. Otherwise removes all prefix and trims.
 * @returns Line with prefix removed and optionally trimmed.
 */
const removeCommentPrefix = (line: string, preserveIndent = false): string => {
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
			// Type assertion safe: MATCH_GROUP_INDEX element always exists per regex pattern
			const MATCH_GROUP_INDEX = 4;
			const rest = match[MATCH_GROUP_INDEX];
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- rest always exists per regex pattern (capturing group always matches)
			if (rest === undefined) {
				// rest should never be undefined per regex pattern, but TypeScript doesn't know this
				return line;
			}
			const restValue = rest;
			// Remove leading whitespace and all asterisks, preserve the rest (which may have indentation spaces)
			// If rest starts with exactly one space, that's the space after the asterisk(s) - remove it
			// But preserve any additional spaces (indentation) - they're part of the content
			// Check if rest starts with a single space followed by non-space (normal case)
			// or multiple spaces (indentation case) - using character scanning instead of regex
			const trimmed = restValue.trimStart();
			const ZERO_LENGTH = 0;
			const SINGLE_SPACE_LENGTH = 1;
			if (trimmed.length < restValue.length) {
				const spaces = restValue.slice(
					ZERO_LENGTH,
					restValue.length - trimmed.length,
				);
				const content = trimmed;
				// If exactly one space, remove it (it's the separator after asterisk)
				// If multiple spaces, keep them (they're indentation)
				if (spaces.length === SINGLE_SPACE_LENGTH) {
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
 * @param lines - Array of string lines to convert.
 * @returns Array of Doc elements (strings are valid Docs).
 */
const linesToDocLines = (lines: readonly string[]): readonly Doc[] =>
	lines.map((line) => line as Doc);

/**
 * Converts string content to Doc (string is a valid Doc).
 * For multi-line content, joins with hardline.
 * @param _content - The string content (unused but kept for API compatibility).
 * @param lines - Array of string lines to convert to Doc.
 * @returns The Doc representation of the content.
 */
const contentToDoc = (_content: string, lines: readonly string[]): Doc => {
	const { join, hardline } = docBuilders;
	const ZERO_LENGTH = 0;
	const SINGLE_LINE = 1;
	const ZERO_INDEX = 0;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- lines are strings which are valid Docs
	if (lines.length === ZERO_LENGTH) {
		return '' as Doc;
	}
	if (lines.length === SINGLE_LINE) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- lines are strings which are valid Docs
		return lines[ZERO_INDEX] as Doc;
	}
	return join(hardline, [...linesToDocLines(lines)]);
};

/**
 * Extracts string content from a Doc for text operations.
 * If Doc is a string, returns it. Otherwise, prints it to string.
 * @param doc - The Doc to extract string content from.
 * @param options - Optional options including printWidth.
 * @param options.printWidth - The print width for formatting complex Docs.
 * @returns The string representation of the Doc.
 */
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- options parameter needs to be mutable for prettier API
const docToString = (doc: Doc, options?: { printWidth?: number }): string => {
	if (typeof doc === 'string') {
		return doc;
	}
	// For complex Docs, print to string
	const DEFAULT_PRINT_WIDTH = 80;
	const DEFAULT_TAB_WIDTH_VALUE = 2;
	return prettier.doc.printer.printDocToString(doc, {
		printWidth: options?.printWidth ?? DEFAULT_PRINT_WIDTH,
		tabWidth: DEFAULT_TAB_WIDTH_VALUE,
	}).formatted;
};

/**
 * Extracts string content from ApexDocContent for text operations.
 * @param doc - The ApexDocContent to extract string content from.
 * @returns The string representation of the content Doc.
 */
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- doc parameter needs mutable access
const getContentString = (doc: ApexDocContent): string =>
	docToString(doc.content);

/**
 * Extracts string lines from ApexDocContent for text operations.
 * @param doc - The ApexDocContent to extract lines from.
 * @returns Array of string lines extracted from the content.
 */
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- doc parameter needs mutable access for lines mapping
const getContentLines = (
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- doc parameter needs mutable access for lines mapping
	doc: ApexDocContent,
): readonly string[] => doc.lines.map((lineItem) => docToString(lineItem));

/**
 * Creates an ApexDocContent from string content and lines.
 * @param type - The type of content ('paragraph' or 'text').
 * @param content - The string content.
 * @param lines - Array of string lines.
 * @param isContinuation - Optional flag indicating if this is a continuation.
 * @returns The created ApexDocContent object.
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for doc content creation
const createDocContent = (
	type: 'paragraph' | 'text',
	content: Readonly<string>,
	lines: readonly string[],
	isContinuation?: boolean,
	// eslint-disable-next-line @typescript-eslint/max-params -- Arrow function signature line
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

	// contentLines comes from lines.slice() which never creates undefined entries
	// Array indexing check removed: contentLines array has no holes
	for (let i = ARRAY_START_INDEX; i < contentLines.length; i++) {
		const line = contentLines[i];
		// Type assertion safe: line is never undefined per array iteration guarantee
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
				const CODE_TAG_LENGTH = 6;
				if (currentContent.slice(j).startsWith('{@code')) {
					codeBlockOpenCount++;
					j += CODE_TAG_LENGTH; // Skip past '{@code'
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
			const ZERO_LENGTH = 0;
			const endsWithSentencePunctuation =
				trimmedEnd.length > ZERO_LENGTH &&
				(trimmedEnd.endsWith('.') ||
					trimmedEnd.endsWith('!') ||
					trimmedEnd.endsWith('?'));
			const nextLine = contentLines[i + INDEX_ONE];
			const nextTrimmed =
				nextLine !== undefined ? removeCommentPrefix(nextLine) : '';
			const CAPITAL_A = 'A';
			const CAPITAL_Z = 'Z';
			const FIRST_CHAR_INDEX = 0;
			const nextStartsWithCapital =
				isNotEmpty(nextTrimmed) &&
				nextTrimmed.charAt(FIRST_CHAR_INDEX) >= CAPITAL_A &&
				nextTrimmed.charAt(FIRST_CHAR_INDEX) <= CAPITAL_Z;

			// Add current line to paragraph
			// line is never undefined per array iteration guarantee
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- line is typed as possibly undefined but never is in practice
			if (line !== undefined) {
				currentParagraph.push(trimmedLine);
				currentParagraphLines.push(line);
			}

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
 * @param docs - Array of Doc-based comment tokens.
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @returns The formatted comment string.
 */
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- docs parameter needs array iteration
// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- docs parameter needs array iteration
const tokensToCommentString = (
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- docs parameter needs array iteration
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

	for (const doc of docs) {
		// docs is readonly ApexDocComment[] and arrays created via push() never have undefined holes
		// Note: Code block docs are converted to content docs in docsToApexDocString
		// before reaching tokensToCommentString, so doc.type is always 'text' or 'paragraph'
		// Annotation docs are handled separately, so we can directly process content docs
		// Type check removed: doc.type is always 'text' or 'paragraph' per above comment
		// Skip code blocks and annotations - they're handled separately
		if (doc.type === 'code' || doc.type === 'annotation') {
			continue;
		}
		// Type guard: doc is now ApexDocContent (text or paragraph)
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

	lines.push(`${baseIndent} */`);
	return lines.join('\n');
};

/**
 * Unified async text wrapping utility that provides consistent wrapping behavior.
 * Used by both token processing and direct content wrapping to ensure uniform results.
 * Splits text into words and wraps using Prettier's fill builder with proper width constraints.
 * Breaks long lines at word boundaries to fit within the specified width.
 * @param textContent - The text content to wrap.
 * @param effectiveWidth - The effective width available for content.
 * @param options - Options including tabWidth and useTabs.
 * @returns Array of wrapped lines without comment prefix.
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
	return wrappedText
		.split('\n')
		.filter((lineItem) => isNotEmpty(lineItem.trim()));
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
 * @param _getCurrentOriginalText - Function to get the original source text (unused but required by Prettier API).
 * @param _getFormattedCodeBlock - Function to get cached embed-formatted comments (unused but required by Prettier API).
 * @returns The formatted comment as a Prettier Doc.
 */
/* eslint-disable @typescript-eslint/max-params, @typescript-eslint/prefer-readonly-parameter-types -- Prettier API requires 7 parameters and mutable types */
const printComment = (
	path: AstPath<ApexNode>,
	_options: ParserOptions,
	_print: (path: AstPath<ApexNode>) => Doc,
	_originalPrintComment: (
		path: AstPath<ApexNode>,
		options: ParserOptions,
		print: (path: AstPath<ApexNode>) => Doc,
	) => Doc,
	options: ParserOptions,
	_getCurrentOriginalText: () => string | undefined,
	_getFormattedCodeBlock: (key: string) => string | undefined,
): Doc => {
	const node = path.getNode();

	if (node !== null && 'value' in node && typeof node['value'] === 'string') {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- node is confirmed to have value property
		const commentNode = node as unknown as { value: string };
		const commentValue = commentNode.value;
		const ZERO_INDENT = 0;
		if (commentValue === '') return '';

		if (isApexDoc(node)) {
			// Check if there's a pre-formatted version from embed processing
			// Use the same cache key calculation as embed function
			const codeTagPos = commentValue.indexOf('{@code');
			const NOT_FOUND_POS = -1;
			const hasCodeTag = codeTagPos !== NOT_FOUND_POS;
			const commentKey = hasCodeTag
				? `${String(commentValue.length)}-${String(codeTagPos)}`
				: null;
			const embedFormattedComment =
				commentKey !== null ? _getFormattedCodeBlock(commentKey) : null;
			const hasEmbedComment =
				embedFormattedComment !== null &&
				embedFormattedComment !== undefined;
			// Use embed-formatted comment if available, otherwise normalize the original comment
			// Normalize the embed-formatted comment to match Prettier's indentation (single space before *)
			// Pass isEmbedFormatted=true to preserve formatted code from embed function
			const commentDoc = hasEmbedComment
				? normalizeSingleApexDocComment(
						embedFormattedComment,
						ZERO_INDENT,
						options,
						true,
					)
				: normalizeSingleApexDocComment(
						commentValue,
						ZERO_INDENT,
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
			const ZERO_INDENT_VALUE = 0;
			const normalizedComment = tokensToCommentString(
				normalizedDocs,
				ZERO_INDENT_VALUE,
				{
					tabWidth: options.tabWidth,
					useTabs: options.useTabs,
				},
			);

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
 * @param comment - The comment to process.
 * @param handlers - Array of handler functions to try.
 * @returns True if any handler successfully processed the comment, false otherwise.
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
