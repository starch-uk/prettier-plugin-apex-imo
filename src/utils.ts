/* eslint-disable @typescript-eslint/no-magic-numbers */
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

export function isListInit(
	node: Readonly<ApexNode>,
): node is Readonly<ApexListInitNode> {
	const cls = node['@class'];
	return (
		cls === 'apex.jorje.data.ast.NewObject$NewListLiteral' ||
		cls === 'apex.jorje.data.ast.NewObject$NewSetLiteral'
	);
}

export function isMapInit(
	node: Readonly<ApexNode>,
): node is Readonly<ApexMapInitNode> {
	return node['@class'] === 'apex.jorje.data.ast.NewObject$NewMapLiteral';
}

export function hasMultipleListEntries(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	node: Readonly<ApexListInitNode>,
): boolean {
	return Array.isArray(node.values) && node.values.length >= 2;
}

export function hasMultipleMapEntries(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	node: Readonly<ApexMapInitNode>,
): boolean {
	return Array.isArray(node.pairs) && node.pairs.length >= 2;
}

export function isAnnotation(
	node: Readonly<ApexNode>,
): node is Readonly<ApexAnnotationNode> {
	return node['@class'] === 'apex.jorje.data.ast.Modifier$Annotation';
}

export function normalizeAnnotationName(name: string): string {
	return APEX_ANNOTATIONS[name.toLowerCase()] ?? name;
}

export function normalizeAnnotationOptionName(
	annotationName: string,
	optionName: string,
): string {
	const optionMap =
		APEX_ANNOTATION_OPTION_NAMES[annotationName.toLowerCase()];
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions
	if (optionMap) {
		const normalized = optionMap[optionName.toLowerCase()];
		if (normalized) return normalized;
	}
	return optionName;
}

/**
 * Normalize a standard object type name to its correct casing
 * @param typeName - The type name to normalize
 * @returns The normalized type name if it's a standard object, otherwise returns the original
 */
export function normalizeStandardObjectType(typeName: string): string {
	if (!typeName || typeof typeName !== 'string') return typeName;
	return STANDARD_OBJECTS[typeName.toLowerCase()] ?? typeName;
}

export function formatAnnotationValue(
	value: Readonly<ApexAnnotationValue>,
): string {
	const cls = value['@class'];
	if (cls === 'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue')
		return 'true';
	if (cls === 'apex.jorje.data.ast.AnnotationValue$FalseAnnotationValue')
		return 'false';
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	const stringValue = (value as unknown as { value: string }).value;
	return stringValue ? `'${stringValue}'` : "''";
}

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

function findApexDocComments(
	text: Readonly<string>,
): { start: number; end: number }[] {
	const comments: { start: number; end: number }[] = [];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '/' && text[i + 1] === '*' && text[i + 2] === '*') {
			const start = i;
			i += 3;
			while (i < text.length - 1) {
				if (text[i] === '*' && text[i + 1] === '/') {
					comments.push({ start, end: i + 2 });
					i = i + 2;
					break;
				}
				i++;
			}
		}
	}
	return comments;
}

function extractCodeFromBlock(
	text: Readonly<string>,
	startPos: number,
): { code: string; endPos: number } | null {
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
	const codeLines = code.split('\n');
	if (codeLines.some((line) => /^\s*\*\s/.test(line))) {
		code = codeLines
			.map((line) => line.replace(/^\s*\*\s?/, '').trimStart())
			.join('\n');
	}
	return { code: code.trim(), endPos: pos };
}

function getIndentLevel(
	line: Readonly<string>,
	tabWidth: number = DEFAULT_TAB_WIDTH,
): number {
	const match = /^[\t ]*/.exec(line)?.[0] ?? '';
	return match.replace(/\t/g, ' '.repeat(tabWidth)).length;
}

function createIndent(
	level: Readonly<number>,
	tabWidth: Readonly<number>,
	useTabs?: Readonly<boolean | null | undefined>,
): string {
	if (level <= 0) return '';
	return useTabs === true
		? '\t'.repeat(Math.floor(level / tabWidth))
		: ' '.repeat(level);
}

function getCommentIndent(
	text: Readonly<string>,
	commentStart: number,
): number {
	const lineEnd = prettier.util.skipToLineEnd(text, commentStart);
	let pos = lineEnd === false ? text.length : lineEnd;
	if (pos < text.length) {
		const afterNewline = prettier.util.skipNewline(text, pos);
		pos = afterNewline === false ? pos + 1 : afterNewline;
	}
	let lineStart = commentStart;
	while (pos < text.length) {
		if (text[pos] === '*') {
			lineStart = pos;
			while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
			return getIndentLevel(
				text.substring(lineStart, pos),
				DEFAULT_TAB_WIDTH,
			);
		}
		if (text[pos] === '/' && text[pos - 1] === '*') break;
		pos++;
	}
	lineStart = commentStart;
	while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
	return getIndentLevel(
		text.substring(lineStart, commentStart),
		DEFAULT_TAB_WIDTH,
	);
}

export function findApexDocCodeBlocks(text: Readonly<string>): CodeBlock[] {
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
}

export async function formatCodeBlock(
	code: Readonly<string>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	options: Readonly<ParserOptions>,
	plugin?: Readonly<unknown>,
): Promise<string> {
	try {
		const trimmedCode = code.trim();
		const isAnnotationCode = trimmedCode.startsWith('@');
		const wrappedCode = isAnnotationCode
			? `public class Temp { ${code} void method() {} }`
			: `public class Temp { void method() { ${code} } }`;
		const formatted = await prettier.format(wrappedCode, {
			parser: 'apex',
			tabWidth: options.tabWidth,
			useTabs: options.useTabs,
			printWidth: options.printWidth,
			plugins: plugin ? [plugin] : [apexPlugin],
		});
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
				continue;
			}
			if (isAnnotationCode && inClass && !inMethod) {
				if (line.includes('void method()') || line.trim() === '}')
					break;
				const lineIndent = getIndentLevel(line, tabWidth);
				codeLines.push(
					createIndent(
						Math.max(0, lineIndent - classIndent - tabWidth),
						tabWidth,
						useTabs,
					) + line.trimStart(),
				);
				continue;
			}
			if (line.includes('void method() {')) {
				methodIndent = getIndentLevel(line, tabWidth);
				inMethod = true;
				methodBraceCount = 1;
				continue;
			}
			if (inMethod) {
				methodBraceCount +=
					(line.match(/\{/g) ?? []).length -
					(line.match(/\}/g) ?? []).length;
				if (methodBraceCount === 0 && line.trim() === '}') break;
				const lineIndent = getIndentLevel(line, tabWidth);
				codeLines.push(
					createIndent(
						Math.max(0, lineIndent - methodIndent - tabWidth),
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
}

export function applyCommentIndentation(
	formattedCode: Readonly<string>,
	codeBlock: ReadonlyCodeBlock,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	options: Readonly<ParserOptions>,
): string {
	const { tabWidth, useTabs } = options;
	const { commentIndent } = codeBlock;
	const lines = formattedCode.split('\n');
	if (lines.length === 0) return '';
	const commentPrefix =
		createIndent(commentIndent, tabWidth, useTabs) + ' * ';
	return lines
		.map((line) => {
			if (line.trim() === '')
				return createIndent(commentIndent, tabWidth, useTabs) + ' *';
			return (
				commentPrefix +
				createIndent(
					getIndentLevel(line, tabWidth),
					tabWidth,
					useTabs,
				) +
				line.trimStart()
			);
		})
		.join('\n');
}
