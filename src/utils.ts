/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import * as prettier from 'prettier';
import * as apexPlugin from 'prettier-plugin-apex';
import type { ParserOptions } from 'prettier';
import type {
	ApexNode,
	ApexListInitNode,
	ApexMapInitNode,
	ApexAnnotationNode,
	ApexAnnotationValue,
} from './types.js';
import {
	APEX_ANNOTATIONS,
	APEX_ANNOTATION_OPTION_NAMES,
} from './refs/apex-annotations.js';
import { STANDARD_OBJECTS } from './refs/standard-objects.js';

const DEFAULT_TAB_WIDTH = 2;

export const isListInit = (
	node: Readonly<ApexNode>,
): node is Readonly<ApexListInitNode> => {
	const cls = node['@class'];
	return (
		cls === 'apex.jorje.data.ast.NewObject$NewListLiteral' ||
		cls === 'apex.jorje.data.ast.NewObject$NewSetLiteral'
	);
};

export const isMapInit = (
	node: Readonly<ApexNode>,
): node is Readonly<ApexMapInitNode> =>
	node['@class'] === 'apex.jorje.data.ast.NewObject$NewMapLiteral';

export const hasMultipleListEntries = (
	node: Readonly<ApexListInitNode>,
): boolean => Array.isArray(node.values) && node.values.length >= 2;

export const hasMultipleMapEntries = (
	node: Readonly<ApexMapInitNode>,
): boolean => Array.isArray(node.pairs) && node.pairs.length >= 2;

export const isAnnotation = (
	node: Readonly<ApexNode>,
): node is Readonly<ApexAnnotationNode> =>
	node['@class'] === 'apex.jorje.data.ast.Modifier$Annotation';

export const normalizeAnnotationName = (name: string): string =>
	APEX_ANNOTATIONS[name.toLowerCase()] ?? name;

export const normalizeAnnotationOptionName = (
	annotationName: string,
	optionName: string,
): string => {
	const optionMap =
		APEX_ANNOTATION_OPTION_NAMES[annotationName.toLowerCase()];
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	return optionMap?.[optionName.toLowerCase()] ?? optionName;
};

export const normalizeStandardObjectType = (typeName: string): string => {
	if (!typeName || typeof typeName !== 'string') return typeName;
	return STANDARD_OBJECTS[typeName.toLowerCase()] ?? typeName;
};

export const formatAnnotationValue = (
	value: Readonly<ApexAnnotationValue>,
): string => {
	const cls = value['@class'];
	if (cls === 'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue')
		return 'true';
	if (cls === 'apex.jorje.data.ast.AnnotationValue$FalseAnnotationValue')
		return 'false';
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	const stringValue = (value as unknown as { value: string }).value;
	return stringValue ? `'${stringValue}'` : "''";
};

export interface CodeBlock {
	startPos: number;
	endPos: number;
	code: string;
	lineNumber: number;
	column: number;
	commentIndent: number;
}

export interface ReadonlyCodeBlock {
	readonly startPos: number;
	readonly endPos: number;
	readonly code: string;
	readonly lineNumber: number;
	readonly column: number;
	readonly commentIndent: number;
}

const findApexDocComments = (
	text: Readonly<string>,
): { start: number; end: number }[] => {
	const comments: { start: number; end: number }[] = [];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '/' && text[i + 1] === '*' && text[i + 2] === '*') {
			const start = i;
			for (i += 3; i < text.length - 1; i++) {
				if (text[i] === '*' && text[i + 1] === '/') {
					comments.push({ start, end: i + 2 });
					i += 2;
					break;
				}
			}
		}
	}
	return comments;
};

const extractCodeFromBlock = (
	text: Readonly<string>,
	startPos: number,
): { code: string; endPos: number } | null => {
	const codeStart = prettier.util.skipWhitespace(text, startPos + 6);
	if (codeStart === false || codeStart >= text.length) return null;
	let braceCount = 1;
	let pos = codeStart;
	while (pos < text.length && braceCount > 0) {
		if (text[pos] === '{') braceCount++;
		else if (text[pos] === '}') braceCount--;
		pos++;
	}
	if (braceCount !== 0) return null;
	let code = text.substring(codeStart, pos - 1);
	if (code.includes('*'))
		code = code
			.split('\n')
			.map((line) => line.replace(/^\s*\*\s?/, '').trimStart())
			.join('\n');
	return { code: code.trim(), endPos: pos };
};

const getIndentLevel = (
	line: Readonly<string>,
	tabWidth: number = DEFAULT_TAB_WIDTH,
): number =>
	(/^[\t ]*/.exec(line)?.[0] ?? '').replace(/\t/g, ' '.repeat(tabWidth))
		.length;

const createIndent = (
	level: Readonly<number>,
	tabWidth: Readonly<number>,
	useTabs?: Readonly<boolean | null | undefined>,
): string =>
	level <= 0
		? ''
		: useTabs === true
			? '\t'.repeat(Math.floor(level / tabWidth))
			: ' '.repeat(level);

const getCommentIndent = (
	text: Readonly<string>,
	commentStart: number,
): number => {
	const lineEnd = prettier.util.skipToLineEnd(text, commentStart);
	let pos = lineEnd === false ? text.length : lineEnd;
	if (pos < text.length) {
		const afterNewline = prettier.util.skipNewline(text, pos);
		pos = afterNewline === false ? pos + 1 : afterNewline;
	}
	let lineStart = commentStart;
	for (; pos < text.length; pos++) {
		if (text[pos] === '*') {
			lineStart = pos;
			while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
			return getIndentLevel(
				text.substring(lineStart, pos),
				DEFAULT_TAB_WIDTH,
			);
		}
		if (text[pos] === '/' && text[pos - 1] === '*') break;
	}
	while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
	return getIndentLevel(
		text.substring(lineStart, commentStart),
		DEFAULT_TAB_WIDTH,
	);
};

export const findApexDocCodeBlocks = (text: Readonly<string>): CodeBlock[] => {
	const blocks: CodeBlock[] = [];
	for (const comment of findApexDocComments(text)) {
		const commentText = text.substring(comment.start, comment.end);
		for (let searchPos = 0; searchPos < commentText.length; ) {
			const codeTagPos = commentText.indexOf('{@code', searchPos);
			if (codeTagPos === -1) break;
			const extraction = extractCodeFromBlock(commentText, codeTagPos);
			if (extraction) {
				const absolutePos = comment.start + codeTagPos;
				const beforeBlock = text.substring(0, absolutePos);
				blocks.push({
					startPos: absolutePos,
					endPos:
						comment.start +
						codeTagPos +
						extraction.endPos -
						codeTagPos,
					code: extraction.code,
					lineNumber: (beforeBlock.match(/\n/g) ?? []).length + 1,
					column: absolutePos - beforeBlock.lastIndexOf('\n') - 1,
					commentIndent: getCommentIndent(text, comment.start),
				});
				searchPos = codeTagPos + extraction.endPos - codeTagPos;
			} else {
				searchPos = codeTagPos + 6;
			}
		}
	}
	return blocks;
};

export const formatCodeBlock = async (
	code: Readonly<string>,
	options: Readonly<ParserOptions>,
	plugin?: Readonly<unknown>,
): Promise<string> => {
	try {
		const isAnnotationCode = code.trim().startsWith('@');
		const formatted = await prettier.format(
			isAnnotationCode
				? `public class Temp { ${code} void method() {} }`
				: `public class Temp { void method() { ${code} } }`,
			{
				parser: 'apex',
				tabWidth: options.tabWidth,
				useTabs: options.useTabs,
				printWidth: options.printWidth,
				plugins: plugin ? [plugin] : [apexPlugin],
			},
		);
		const lines = formatted.split('\n');
		const codeLines: string[] = [];
		const { tabWidth, useTabs } = options;
		let methodIndent = 0;
		let methodBraceCount = 0;
		let classIndent = 0;
		let inClass = false;
		let inMethod = false;
		for (const line of lines) {
			if (line.includes('public class Temp')) {
				classIndent = getIndentLevel(line, tabWidth);
				inClass = true;
			} else if (isAnnotationCode && inClass && !inMethod) {
				if (line.includes('void method()') || line.trim() === '}')
					break;
				codeLines.push(
					createIndent(
						Math.max(
							0,
							getIndentLevel(line, tabWidth) -
								classIndent -
								tabWidth,
						),
						tabWidth,
						useTabs,
					) + line.trimStart(),
				);
			} else if (line.includes('void method() {')) {
				methodIndent = getIndentLevel(line, tabWidth);
				inMethod = true;
				methodBraceCount = 1;
			} else if (inMethod) {
				methodBraceCount +=
					(line.match(/\{/g) ?? []).length -
					(line.match(/\}/g) ?? []).length;
				if (!methodBraceCount && line.trim() === '}') break;
				codeLines.push(
					createIndent(
						Math.max(
							0,
							getIndentLevel(line, tabWidth) -
								methodIndent -
								tabWidth,
						),
						tabWidth,
						useTabs,
					) + line.trimStart(),
				);
			}
		}
		return codeLines.join('\n').trimEnd();
	} catch {
		return `__FORMAT_FAILED__${code}`;
	}
};

export const applyCommentIndentation = (
	formattedCode: Readonly<string>,
	codeBlock: ReadonlyCodeBlock,
	options: Readonly<ParserOptions>,
): string => {
	const { tabWidth, useTabs } = options;
	const { commentIndent } = codeBlock;
	const lines = formattedCode.split('\n');
	if (!lines.length) return '';
	const commentPrefix =
		createIndent(commentIndent, tabWidth, useTabs) + ' * ';
	return lines
		.map((line) =>
			line.trim() === ''
				? createIndent(commentIndent, tabWidth, useTabs) + ' *'
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
