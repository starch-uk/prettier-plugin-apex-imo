/**
 * @file Functions for handling ApexDoc code blocks - extraction, formatting, and embed printer logic.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import type { ParserOptions } from 'prettier';
import * as prettier from 'prettier';
import { NOT_FOUND_INDEX, removeCommentPrefix } from './comments.js';
import {
	EMPTY,
	INDEX_ONE,
	formatApexCodeWithFallback,
	preserveBlankLineAfterClosingBrace,
} from './utils.js';
import type { CodeBlockToken } from './comments.js';

const CODE_TAG = '{@code';
const CODE_TAG_LENGTH = CODE_TAG.length;
const EMPTY_CODE_TAG = '{@code}';
const INITIAL_BRACE_COUNT = 1;
const COMMENT_PREFIX_LENGTH = 4;
const CLOSING_COMMENT_LENGTH = 5;
const ALT_CLOSING_COMMENT_LENGTH = 4;
const SKIP_FIRST_TWO_LINES = 2;

/**
 * Extracts code from a code block by counting braces.
 * @param text - The text containing the code block.
 * @param startPos - The starting position of the code tag.
 * @returns The extracted code and end position, or null if extraction fails.
 * @example
 * extractCodeFromBlock('code block text', 0)
 */

const extractCodeFromBlock = (
	text: Readonly<string>,
	startPos: number,
): { code: string; endPos: number } | null => {
	const codeStart = prettier.util.skipWhitespace(
		text,
		startPos + CODE_TAG_LENGTH,
	) as number;
	let braceCount = INITIAL_BRACE_COUNT;
	let pos = codeStart;
	let lastClosingBracePos = NOT_FOUND_INDEX;
	while (pos < text.length && braceCount > EMPTY) {
		if (text[pos] === '{') {
			braceCount++;
		} else if (text[pos] === '}') {
			braceCount--;
			lastClosingBracePos = pos;
		}
		pos++;
	}
	if (braceCount !== EMPTY) {
		if (lastClosingBracePos !== NOT_FOUND_INDEX) {
			// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- string position offset
			pos = lastClosingBracePos + 1;
		} else {
			return null;
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- string position offset
	const rawCode = text.substring(codeStart, pos - 1);
	const code = rawCode.includes('*')
		? rawCode
				.split('\n')
				.map((line) => {
					// Remove comment asterisk prefix, preserving content indentation
					const afterAsterisk = removeCommentPrefix(line, true);
					// Check if this is an empty line (only whitespace)
					if (afterAsterisk.trim() === '') {
						// This is an empty line - preserve it as empty string
						return '';
					}
					// Preserve content with its original indentation
					return afterAsterisk;
				})
				.join('\n')
		: rawCode;
	// Preserve blank lines: remove only leading/trailing blank lines, keep middle ones
	// Split into lines to process leading/trailing separately
	const codeLines = code.split('\n');
	const FIRST_LINE_INDEX = 0;
	while (
		codeLines.length > 0 &&
		codeLines[FIRST_LINE_INDEX]?.trim().length === EMPTY
	) {
		codeLines.shift();
	}
	const LAST_LINE_INDEX = codeLines.length - 1;
	while (
		codeLines.length > 0 &&
		codeLines[LAST_LINE_INDEX]?.trim().length === EMPTY
	) {
		codeLines.pop();
	}
	// Join back - middle blank lines are preserved
	const trimmedCode = codeLines.join('\n');
	return { code: trimmedCode, endPos: pos };
};

/**
 * Processes comment lines to handle code block boundaries.
 * Tracks code blocks using brace counting and preserves structure.
 * @param lines - The comment lines to process.
 * @returns The processed lines with code block structure preserved.
 * @example
 * processCodeBlockLines([' * code block line', ' *   System.debug("test");', ' * }'])
 */
const processCodeBlockLines = (lines: readonly string[]): readonly string[] => {
	let inCodeBlock = false;
	let codeBlockBraceCount = 0;

	return lines.map((commentLine, index) => {
		const prefix = index > EMPTY ? ' ' : '';
		const trimmedLine = commentLine.trim();

		if (trimmedLine.startsWith(CODE_TAG)) {
			inCodeBlock = true;
			codeBlockBraceCount = INITIAL_BRACE_COUNT;
		}
		let willEndCodeBlock = false;

		if (inCodeBlock) {
			for (const char of trimmedLine) {
				if (char === '{') codeBlockBraceCount++;
				else if (char === '}') codeBlockBraceCount--;
			}
			willEndCodeBlock = codeBlockBraceCount === EMPTY;
		}

		if (inCodeBlock && !trimmedLine.startsWith(CODE_TAG)) {
			const trimmed = removeCommentPrefix(commentLine, true);
			if (willEndCodeBlock) {
				inCodeBlock = false;
			}
			return prefix + trimmed;
		}

		if (trimmedLine === '}') {
			return prefix + commentLine.trimStart();
		}
		return (
			prefix +
			(index < lines.length - 1 ? trimmedLine : commentLine.trimStart())
		);
	});
};

/**
 * Shared logic for formatting code blocks with prettier.
 * @param normalizedCode - The normalized code to format.
 * @param optionsWithPlugin - Parser options with plugin configured.
 * @returns The formatted code string.
 */
/**
 * Formats a CodeBlockToken using prettier with our plugin and effective page width.
 * @param root0 - The parameters object.
 * @param root0.token - The code block token to format.
 * @param root0.effectiveWidth - The effective page width (reduced from printWidth).
 * @param root0.embedOptions - Parser options for formatting.
 * @param root0.currentPluginInstance - Plugin instance to ensure wrapped printer is used.
 * @returns Updated CodeBlockToken with formattedCode populated.
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated -- Legacy token type still in use
const formatCodeBlockToken = async ({
	token,
	effectiveWidth,
	embedOptions,
	currentPluginInstance,
}: {
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- Legacy token type still in use
	readonly token: CodeBlockToken;
	readonly effectiveWidth: number;
	readonly embedOptions: ParserOptions;
	readonly currentPluginInstance: { default: unknown } | undefined;
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- Legacy token type still in use
}): Promise<CodeBlockToken> => {
	if (currentPluginInstance === undefined || currentPluginInstance.default === undefined) {
		throw new Error(
			'prettier-plugin-apex-imo: currentPluginInstance.default is required for formatCodeBlockToken',
		);
	}
	const pluginDefault = currentPluginInstance.default;
	if (pluginDefault === null || pluginDefault === undefined) {
		throw new Error(
			'prettier-plugin-apex-imo: currentPluginInstance.default is required for formatCodeBlockToken',
		);
	}
	const optionsWithPlugin = {
		...embedOptions,
		plugins: [pluginDefault],
		printWidth: effectiveWidth,
	};

	// #region agent log
	fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apexdoc-code.ts:192',message:'formatCodeBlockToken: plugin setup',data:{hasPlugin:!!pluginDefault,hasPrinters:!!(pluginDefault as {printers?:unknown})?.printers,codePreview:token.rawCode.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,D'})}).catch(()=>{});
	// #endregion

	// Format with prettier, trying apex-anonymous first, then apex
	// Annotations are normalized via AST during printing (see printAnnotation in annotations.ts)
	const formatted = await formatApexCodeWithFallback(
		token.rawCode,
		optionsWithPlugin,
	);

	// #region agent log
	fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'apexdoc-code.ts:205',message:'formatCodeBlockToken: formatted result',data:{formattedPreview:formatted.substring(0,150),hasAnnotation:formatted.includes('@'),normalized:formatted.includes('Label')||formatted.includes('label')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,E'})}).catch(()=>{});
	// #endregion

	// Preserve blank lines after closing braces when followed by annotations or access modifiers
	const formattedLines = formatted.trim().split('\n');
	const resultLines: string[] = [];
	for (let i = 0; i < formattedLines.length; i++) {
		if (i < 0 || i >= formattedLines.length) {
			continue;
		}
		const formattedLine = formattedLines[i];
		if (formattedLine === undefined) continue;
		resultLines.push(formattedLine);

		if (preserveBlankLineAfterClosingBrace(formattedLines, i)) {
			resultLines.push('');
		}
	}

	return {
		...token,
		formattedCode: resultLines.join('\n').trimEnd(),
	};
};

/**
 * Processes embed result to extract formatted code lines.
 * @param embedResult - The embed result string to process.
 * @returns Array of extracted code lines.
 */
const extractCodeFromEmbedResult = (embedResult: string): string[] => {
	let embedContent = embedResult;
	if (embedContent.startsWith('/**\n')) {
		embedContent = embedContent.substring(COMMENT_PREFIX_LENGTH);
	}
	if (embedContent.endsWith('\n */\n')) {
		embedContent = embedContent.slice(0, -CLOSING_COMMENT_LENGTH);
	} else if (embedContent.endsWith('\n */')) {
		embedContent = embedContent.slice(0, -ALT_CLOSING_COMMENT_LENGTH);
	}

	const embedLines = embedContent.split('\n');
	const processedLines = embedLines.map((line: string) => {
		let start = 0;
		while (
			start < line.length &&
			(line[start] === ' ' || line[start] === '\t')
		) {
			start++;
		}
		if (start < line.length && line[start] === '*') {
			start++;
			if (start < line.length && line[start] === ' ') {
				start++;
			}
			return line.substring(start);
		}
		return line;
	});

	const codeStart = processedLines.findIndex(
		(line: string | undefined) => line != null && line.startsWith('{@code'),
	);
	const codeEnd = processedLines.findIndex(
		(line: string | undefined, i: number) =>
			i > codeStart && line != null && line === '}',
	);

	if (codeStart >= EMPTY && codeEnd > codeStart) {
		return processedLines
			.slice(codeStart + INDEX_ONE, codeEnd)
			.filter((line): line is string => typeof line === 'string');
	}

	return processedLines.slice(SKIP_FIRST_TWO_LINES);
};

/**
 * Processes a {&#64;code} block, returning formatted lines.
 * @param codeBlock - The code block text to process.
 * @param _options - Parser options (unused).
 * @param getFormattedCodeBlock - Function to get formatted code blocks.
 * @param commentKey - Key for the comment or null.
 * @param _embedOptions - Embed options (unused).
 * @returns Array of formatted lines.
 */
// eslint-disable-next-line @typescript-eslint/max-params
function processCodeBlock(
	codeBlock: string,
	_options: ParserOptions,
	getFormattedCodeBlock: (key: string) => string | undefined,
	commentKey: string | null,
	_embedOptions: ParserOptions,
): string[] {
	const match = /^\{@code\s*([\s\S]*?)\s*\}$/.exec(codeBlock);
	if (!match) return [codeBlock];

	const CODE_CONTENT_GROUP = 1;
	const codeContent = match[CODE_CONTENT_GROUP];
	if (
		codeContent === null ||
		codeContent === undefined ||
		codeContent.length === EMPTY
	) {
		return [codeBlock];
	}

	const codeLines = codeContent.split('\n');

	if (codeLines.length === INDEX_ONE) {
		const separator = codeContent.trim().endsWith(';') ? ' ' : '';
		return [`{@code ${codeContent}${separator}}`];
	}

	const embedResult = commentKey ? getFormattedCodeBlock(commentKey) : null;
	if (embedResult) {
		const extractedCodeLines = extractCodeFromEmbedResult(embedResult);
		return [`{@code`, ...extractedCodeLines, `}`];
	}

	return [`{@code`, ...codeLines, `}`];
}

export {
	CODE_TAG,
	CODE_TAG_LENGTH,
	EMPTY_CODE_TAG,
	extractCodeFromBlock,
	formatCodeBlockToken,
	processCodeBlock,
	processCodeBlockLines,
};
