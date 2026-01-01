/**
 * @file Functions for finding and formatting ApexDoc code blocks within comments.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import * as prettier from 'prettier';
import * as apexPlugin from 'prettier-plugin-apex';
import type { ParserOptions, Plugin } from 'prettier';
import type { ApexNode } from './types.js';
import {
	findApexDocComments,
	getCommentIndent,
	createIndent,
	getIndentLevel,
} from './comments.js';
import { createWrappedPrinter } from './printer.js';

const FORMAT_FAILED_PREFIX = '__FORMAT_FAILED__';

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

const CODE_TAG = '{@code';

/**
 * Length of '{@code'.
 */
const CODE_TAG_LENGTH = 6;
const EMPTY_CODE_TAG = '{@code}';
const INITIAL_BRACE_COUNT = 1;
const ARRAY_START_INDEX = 0;
const STRING_OFFSET = 1;
const NOT_FOUND_INDEX = -1;
const LINE_NUMBER_OFFSET = 1;
const COLUMN_OFFSET = 1;
const MIN_INDENT_LEVEL = 0;

/**
 * Creates a plugin instance with the wrapped printer for code block formatting.
 * This ensures that lists and maps are always formatted multi-line as expected.
 * @returns A plugin instance with the wrapped printer.
 * @example
 * ```typescript
 * const plugin = createCodeBlockPlugin();
 * const formatted = await prettier.format(code, { plugins: [plugin] });
 * ```
 */
const createCodeBlockPlugin = (): Plugin<ApexNode> => {
	const apexPrinter = (apexPlugin as { printers?: { apex?: unknown } })
		.printers?.apex;
	if (
		typeof apexPrinter !== 'object' ||
		apexPrinter === null ||
		typeof (apexPrinter as { print?: unknown }).print !== 'function'
	) {
		// Fallback to raw plugin if printer is not available
		return apexPlugin as unknown as Plugin<ApexNode>;
	}
	const wrappedPrinter = createWrappedPrinter(
		// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- type parameter index must be literal 0
		apexPrinter as Parameters<typeof createWrappedPrinter>[0],
	);
	const apexPluginTyped = apexPlugin as unknown as Plugin<ApexNode>;
	return {
		...apexPluginTyped,
		printers: { apex: wrappedPrinter },
	};
};

const codeBlockPlugin = createCodeBlockPlugin();

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
	while (pos < text.length && braceCount > ARRAY_START_INDEX) {
		if (text[pos] === '{') braceCount++;
		else if (text[pos] === '}') braceCount--;
		pos++;
	}
	if (braceCount !== ARRAY_START_INDEX) return null;
	const rawCode = text.substring(codeStart, pos - STRING_OFFSET);
	const code = rawCode.includes('*')
		? rawCode
				.split('\n')
				.map((line) => line.replace(/^\s*\*\s?/, '').trimStart())
				.join('\n')
		: rawCode;
	return { code: code.trim(), endPos: pos };
};

const findApexDocCodeBlocks = (text: Readonly<string>): CodeBlock[] => {
	const blocks: CodeBlock[] = [];
	for (const comment of findApexDocComments(text)) {
		const commentStart = comment.start;
		const commentText = text.substring(commentStart, comment.end);
		const commentIndent = getCommentIndent(text, commentStart);
		for (
			let searchPos = ARRAY_START_INDEX;
			searchPos < commentText.length;
		) {
			const codeTagPos = commentText.indexOf(CODE_TAG, searchPos);
			if (codeTagPos === NOT_FOUND_INDEX) break;
			const extraction = extractCodeFromBlock(commentText, codeTagPos);
			if (extraction) {
				const absolutePos = commentStart + codeTagPos;
				const beforeBlock = text.substring(
					ARRAY_START_INDEX,
					absolutePos,
				);
				const lastNewlinePos = beforeBlock.lastIndexOf('\n');
				const extractionEndOffset = extraction.endPos - codeTagPos;
				blocks.push({
					code: extraction.code,
					column: absolutePos - lastNewlinePos - COLUMN_OFFSET,
					commentIndent,
					endPos: commentStart + codeTagPos + extractionEndOffset,
					lineNumber:
						(beforeBlock.match(/\n/g) ?? []).length +
						LINE_NUMBER_OFFSET,
					startPos: absolutePos,
				});
				searchPos = codeTagPos + extractionEndOffset;
			} else {
				searchPos = codeTagPos + CODE_TAG_LENGTH;
			}
		}
	}
	return blocks;
};

const extractAnnotationCode = (
	lines: readonly string[],
	tabWidth: number,
	useTabs: boolean | null | undefined,
): string[] => {
	const codeLines: string[] = [];
	let classIndent = 0;
	const indentOffset = tabWidth;
	for (const line of lines) {
		if (line.includes('public class Temp')) {
			classIndent = getIndentLevel(line, tabWidth);
			continue;
		}
		// Note: formatCodeBlock always wraps code in 'public class Temp { ... }',
		// so the class is always on the first line. We can process lines directly.
		if (line.includes('void method()') || line.trim() === '}') break;
		const lineIndent = getIndentLevel(line, tabWidth);
		const relativeIndent = Math.max(
			MIN_INDENT_LEVEL,
			lineIndent - classIndent - indentOffset,
		);
		codeLines.push(
			createIndent(relativeIndent, tabWidth, useTabs) + line.trimStart(),
		);
	}
	return codeLines;
};

const extractMethodCode = (
	lines: readonly string[],
	tabWidth: number,
	useTabs: boolean | null | undefined,
): string[] => {
	const codeLines: string[] = [];
	let methodIndent = 0;
	let methodBraceCount = 0;
	let inMethod = false;
	const indentOffset = tabWidth;
	for (const line of lines) {
		if (line.includes('void method() {')) {
			methodIndent = getIndentLevel(line, tabWidth);
			inMethod = true;
			methodBraceCount = INITIAL_BRACE_COUNT;
		} else if (inMethod) {
			methodBraceCount +=
				(line.match(/\{/g) ?? []).length -
				(line.match(/\}/g) ?? []).length;
			if (!methodBraceCount && line.trim() === '}') break;
			const lineIndent = getIndentLevel(line, tabWidth);
			const relativeIndent = Math.max(
				MIN_INDENT_LEVEL,
				lineIndent - methodIndent - indentOffset,
			);
			codeLines.push(
				createIndent(relativeIndent, tabWidth, useTabs) +
					line.trimStart(),
			);
		}
	}
	return codeLines;
};

const formatCodeBlock = async (
	code: Readonly<string>,
	options: Readonly<ParserOptions>,
	plugin?: Readonly<unknown>,
): Promise<string> => {
	try {
		const trimmedCode = code.trim();
		const isAnnotationCode = trimmedCode.startsWith('@');
		const { tabWidth, useTabs } = options;
		// Always use a plugin with the wrapped printer to ensure multi-line list formatting
		// If a plugin is provided, use it; otherwise use the codeBlockPlugin with wrapped printer
		const pluginToUse = plugin ?? codeBlockPlugin;
		const formatted = await prettier.format(
			isAnnotationCode
				? `public class Temp { ${code} void method() {} }`
				: `public class Temp { void method() { ${code} } }`,
			{
				parser: 'apex',
				tabWidth,
				...(useTabs !== undefined && { useTabs }),
				plugins: [pluginToUse],
				printWidth: options.printWidth,
			},
		);
		const lines = formatted.split('\n');
		const codeLines = isAnnotationCode
			? extractAnnotationCode(lines, tabWidth, useTabs)
			: extractMethodCode(lines, tabWidth, useTabs);
		return codeLines.join('\n').trimEnd();
	} catch {
		return `${FORMAT_FAILED_PREFIX}${code}`;
	}
};

export {
	FORMAT_FAILED_PREFIX,
	EMPTY_CODE_TAG,
	findApexDocCodeBlocks,
	formatCodeBlock,
};
export type { CodeBlock, ReadonlyCodeBlock };
