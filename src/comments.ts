/**
 * @file Utility functions for finding and processing ApexDoc comments and their indentation.
 */

const COMMENT_START_MARKER = '/**';
const COMMENT_END_MARKER = '*/';
const COMMENT_START_LENGTH = COMMENT_START_MARKER.length;
const COMMENT_END_LENGTH = COMMENT_END_MARKER.length;
const MIN_INDENT_LEVEL = 0;
const DEFAULT_TAB_WIDTH = 2;
const ARRAY_START_INDEX = 0;
const STRING_OFFSET = 1;
const INDEX_ONE = 1;
const INDEX_TWO = 2;

const isCommentStart = (text: string, pos: number): boolean =>
	text.substring(pos, pos + COMMENT_START_LENGTH) === COMMENT_START_MARKER;

const getCommentEndLength = (text: string, pos: number): number => {
	// Check for standard */ first
	if (text.substring(pos, pos + COMMENT_END_LENGTH) === COMMENT_END_MARKER) {
		return COMMENT_END_LENGTH;
	}
	// Check for **/, ***/, etc.
	let asteriskCount = 0;
	let checkPos = pos;
	while (checkPos < text.length && text[checkPos] === '*') {
		asteriskCount++;
		checkPos++;
	}
	// Must have at least 2 asterisks and then a /
	if (
		asteriskCount >= INDEX_TWO &&
		checkPos < text.length &&
		text[checkPos] === '/'
	) {
		return asteriskCount + STRING_OFFSET; // asterisks + /
	}
	return ARRAY_START_INDEX; // Not a valid comment end
};

const findApexDocComments = (
	text: Readonly<string>,
): { start: number; end: number }[] => {
	const comments: { start: number; end: number }[] = [];
	for (let i = ARRAY_START_INDEX; i < text.length; i++) {
		if (isCommentStart(text, i)) {
			const start = i;
			for (
				i += COMMENT_START_LENGTH;
				i < text.length - STRING_OFFSET;
				i++
			) {
				const endLength = getCommentEndLength(text, i);
				if (endLength > ARRAY_START_INDEX) {
					comments.push({ end: i + endLength, start });
					i += endLength - STRING_OFFSET;
					break;
				}
			}
		}
	}
	return comments;
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

const applyCommentIndentation = (
	formattedCode: Readonly<string>,
	codeBlock: Readonly<{ readonly commentIndent: number }>,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): string => {
	const { tabWidth, useTabs } = options;
	const { commentIndent } = codeBlock;
	const baseIndent = createIndent(commentIndent, tabWidth, useTabs);
	// Handle completely empty input (no content, not even newlines)
	if (formattedCode.length === ARRAY_START_INDEX) {
		return `${baseIndent} *`;
	}
	const lines = formattedCode.split('\n');
	const commentPrefix = `${baseIndent} * `;
	return lines
		.map((line) =>
			line.trim() === ''
				? commentPrefix
				: `${commentPrefix}${createIndent(
						getIndentLevel(line, tabWidth),
						tabWidth,
						useTabs,
					)}${line.trimStart()}`,
		)
		.join('\n');
};

const createClosingIndent = createIndent;

/**
 * Normalizes a block comment to standard format.
 * Handles malformed comments by normalizing markers, asterisks, and indentation.
 * @param commentValue - The comment text (e.g., comment block).
 * @param commentIndent - The indentation level of the comment in spaces.
 * @param options - Options including tabWidth and useTabs.
 * @returns The normalized comment value.
 */
const normalizeBlockComment = (
	commentValue: Readonly<string>,
	commentIndent: number,
	options: Readonly<{
		readonly tabWidth: number;
		readonly useTabs?: boolean | null | undefined;
	}>,
): string => {
	const { tabWidth } = options;
	// Normalize comment markers first
	// 1. Normalize comment start: /***** -> /**
	let normalizedComment = commentValue.replace(/^(\s*)\/\*+/, '$1/**');
	// 2. Normalize comment end: **/ or more -> */ (preserve single */)
	// Match 2+ asterisks before / and normalize to */, handling optional trailing whitespace/newlines
	// Also handle cases where **/ appears in the middle of the comment (shouldn't happen, but be safe)
	normalizedComment = normalizedComment.replace(/\*{2,}\//g, '*/');
	// 3. Normalize lines with multiple asterisks: ** @param -> * @param
	// 4. Add asterisk to lines with no asterisk (but not the first line after /** or last line before */)
	const lines = normalizedComment.split('\n');
	const normalizedLines: string[] = [];
	const baseIndent = createIndent(commentIndent, tabWidth, options.useTabs);
	for (let i = ARRAY_START_INDEX; i < lines.length; i++) {
		const line = lines[i] ?? '';
		// Skip the first line (/**) and last line (*/)
		if (i === ARRAY_START_INDEX || i === lines.length - INDEX_ONE) {
			// Normalize comment end if it has extra asterisks
			if (i === lines.length - INDEX_ONE && line.includes('**/')) {
				normalizedLines.push(line.replace(/\*{2,}\//, '*/'));
			} else {
				normalizedLines.push(line);
			}
			continue;
		}
		// Check if line has asterisk(s) - match leading whitespace, then asterisk(s), then optional whitespace
		// Also handle lines that start with asterisk but have no leading whitespace (like "* @return")
		const asteriskMatch = /^(\s*)(\*+)(\s*)(.*)$/.exec(line);
		const asteriskMatchValue = asteriskMatch?.[ARRAY_START_INDEX];
		// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- asteriskMatchValue is string | undefined from regex exec
		if (asteriskMatchValue) {
			// Normalize multiple asterisks to single asterisk
			// Normalize indentation to match comment indent level
			// asteriskMatch groups: [0]=full match, [1]=leading whitespace, [2]=asterisks, [3]=whitespace after asterisks, [4]=rest of line
			// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Array index 4 for regex match group
			let restOfLine = asteriskMatch[4] ?? '';
			// Remove any leading asterisks (handle cases like "*   * @param" or "*** {@code")
			restOfLine = restOfLine.replace(/^\s*\*+\s*/, '');
			// Normal line - use consistent ' * ' spacing
			normalizedLines.push(`${baseIndent} * ${restOfLine.trimStart()}`);
		} else {
			// Line has no asterisk - add one with proper indentation
			// But check if line starts with asterisk but no leading whitespace (like "* @return")
			const trimmed = line.trimStart();
			if (trimmed.startsWith('*')) {
				// Line has asterisk but no leading whitespace - normalize it
				const afterAsterisk = trimmed.substring(INDEX_ONE).trimStart();
				normalizedLines.push(`${baseIndent} * ${afterAsterisk}`);
			} else {
				// Line truly has no asterisk - add one with proper indentation
				normalizedLines.push(`${baseIndent} * ${line.trimStart()}`);
			}
		}
	}
	normalizedComment = normalizedLines.join('\n');
	return normalizedComment;
};

const EMPTY = 0;

export {
	findApexDocComments,
	getIndentLevel,
	createIndent,
	getCommentIndent,
	applyCommentIndentation,
	createClosingIndent,
	normalizeBlockComment,
	ARRAY_START_INDEX,
	DEFAULT_TAB_WIDTH,
	INDEX_ONE,
	INDEX_TWO,
	STRING_OFFSET,
	MIN_INDENT_LEVEL,
	EMPTY,
};
