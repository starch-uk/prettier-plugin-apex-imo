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

const isCommentStart = (text: string, pos: number): boolean =>
	text.substring(pos, pos + COMMENT_START_LENGTH) === COMMENT_START_MARKER;

const isCommentEnd = (text: string, pos: number): boolean =>
	text.substring(pos, pos + COMMENT_END_LENGTH) === COMMENT_END_MARKER;

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
				if (isCommentEnd(text, i)) {
					comments.push({ end: i + COMMENT_END_LENGTH, start });
					i += COMMENT_END_LENGTH - STRING_OFFSET;
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
	const lines = formattedCode.split('\n');
	const baseIndent = createIndent(commentIndent, tabWidth, useTabs);
	const commentPrefix = baseIndent + ' * ';
	return lines
		.map((line) =>
			line.trim() === ''
				? baseIndent + ' *'
				: commentPrefix +
					createIndent(
						getIndentLevel(line, tabWidth),
						tabWidth,
						useTabs,
					) +
					line.trimStart(),
		)
		.join('\n');
};

const createClosingIndent = (
	commentIndent: number,
	tabWidth: number,
	useTabs: boolean | null | undefined,
): string => createIndent(commentIndent, tabWidth, useTabs);

export {
	findApexDocComments,
	getIndentLevel,
	createIndent,
	getCommentIndent,
	applyCommentIndentation,
	createClosingIndent,
};
