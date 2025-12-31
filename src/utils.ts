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

// Prettier's default tabWidth is 2 (as documented in prettier's doc.d.ts)
// This matches prettier's default and avoids hardcoding magic numbers
const prettierDefaultTabWidth = 2;

// Constants for magic numbers
const magicNumbers = {
	zero: 0,
	one: 1,
	two: 2,
	three: 3,
	six: 6,
	seven: 7,
	thirtySix: 36,
	eighty: 80,
};

/**
 * Check if node is a List or Set literal initializer
 */
export function isListInit(
	node: Readonly<ApexNode>,
): node is Readonly<ApexListInitNode> {
	const nodeClass = node['@class'];
	return (
		nodeClass === 'apex.jorje.data.ast.NewObject$NewListLiteral' ||
		nodeClass === 'apex.jorje.data.ast.NewObject$NewSetLiteral'
	);
}

/**
 * Check if node is a Map literal initializer
 */
export function isMapInit(
	node: Readonly<ApexNode>,
): node is Readonly<ApexMapInitNode> {
	return node['@class'] === 'apex.jorje.data.ast.NewObject$NewMapLiteral';
}

/**
 * Check if a List/Set has multiple entries (2+)
 */
export function hasMultipleListEntries(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	node: Readonly<ApexListInitNode>,
): boolean {
	const minEntries = magicNumbers.two;
	return Array.isArray(node.values) && node.values.length >= minEntries;
}

/**
 * Check if a Map has multiple entries (2+)
 */
export function hasMultipleMapEntries(
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	node: Readonly<ApexMapInitNode>,
): boolean {
	const minEntries = magicNumbers.two;
	return Array.isArray(node.pairs) && node.pairs.length >= minEntries;
}

/**
 * Determine if this node should be forced to multiline
 */
export function shouldForceMultiline(node: Readonly<ApexNode>): boolean {
	if (isListInit(node)) {
		return hasMultipleListEntries(node);
	}
	if (isMapInit(node)) {
		return hasMultipleMapEntries(node);
	}
	return false;
}

/**
 * Check if node is an annotation
 */
export function isAnnotation(
	node: Readonly<ApexNode>,
): node is Readonly<ApexAnnotationNode> {
	return node['@class'] === 'apex.jorje.data.ast.Modifier$Annotation';
}

/**
 * Normalize annotation name to PascalCase
 */
export function normalizeAnnotationName(name: string): string {
	const lowerName = name.toLowerCase();
	return APEX_ANNOTATIONS[lowerName] ?? name; // Fallback to original if not found
}

/**
 * Normalize annotation option name to camelCase
 */
export function normalizeAnnotationOptionName(
	annotationName: string,
	optionName: string,
): string {
	const lowerAnnotation = annotationName.toLowerCase();
	const lowerOption = optionName.toLowerCase();
	const optionMap = APEX_ANNOTATION_OPTION_NAMES[lowerAnnotation];
	const normalizedOption = optionMap[lowerOption];
	if (normalizedOption) {
		return normalizedOption;
	}
	return optionName; // Fallback to original if not found
}

/**
 * Format annotation value as string
 */
export function formatAnnotationValue(
	value: Readonly<ApexAnnotationValue>,
): string {
	const valueClass = value['@class'];
	if (
		valueClass === 'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue'
	) {
		return 'true';
	}
	if (
		valueClass ===
		'apex.jorje.data.ast.AnnotationValue$FalseAnnotationValue'
	) {
		return 'false';
	}
	// StringAnnotationValue is the only remaining case after True/False checks
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	const stringValue = (value as unknown as { value: string }).value;
	if (stringValue) {
		return `'${stringValue}'`;
	}
	return "''";
}

/**
 * Represents a {@code} block found in ApexDoc comments
 */
export interface CodeBlock {
	/** Start position of {@code in the text */
	startPos: number;
	/** End position of the closing } */
	endPos: number;
	/** The code content between {@code and } */
	code: string;
	/** The line number where {@code starts */
	lineNumber: number;
	/** The column where {@code starts */
	column: number;
	/** The indentation level of the comment block (for * alignment) */
	commentIndent: number;
}

/**
 * Readonly version of CodeBlock for use in function parameters
 */
export interface ReadonlyCodeBlock {
	readonly startPos: number;
	readonly endPos: number;
	readonly code: string;
	readonly lineNumber: number;
	readonly column: number;
	readonly commentIndent: number;
}

/**
 * Find all ApexDoc comment blocks (slash-star-star ... star-slash) in the text
 */
function findApexDocComments(text: string): { start: number; end: number }[] {
	const comments: { start: number; end: number }[] = [];
	let i = magicNumbers.zero;

	while (i < text.length) {
		// Look for /** (start of ApexDoc comment)
		if (
			text[i] === '/' &&
			text[i + magicNumbers.one] === '*' &&
			text[i + magicNumbers.two] === '*'
		) {
			const start = i;
			i += magicNumbers.three; // Skip /**

			// Find the closing */
			while (i < text.length - magicNumbers.one) {
				if (text[i] === '*' && text[i + magicNumbers.one] === '/') {
					const end = i + magicNumbers.two; // Include */
					comments.push({ start, end });
					i = end;
					break;
				}
				i++;
			}
		} else {
			i++;
		}
	}

	return comments;
}

/**
 * Extract code content from a {@code} block
 * {@code} blocks have the format: {@code code here }
 * The code can contain braces, so we need to match them to find the closing }
 */
function extractCodeFromBlock(
	text: string,
	startPos: number,
): { code: string; endPos: number } | null {
	// startPos is the position of {@code
	// The { of {@code is at startPos
	// Skip past {@code to find where the code starts
	const codeStartAfterTag = startPos + magicNumbers.six; // {@code is 6 characters

	// Skip whitespace after {@code using prettier's utility
	const skippedWhitespace = prettier.util.skipWhitespace(
		text,
		codeStartAfterTag,
	);
	if (skippedWhitespace === false) {
		return null;
	}
	const codeStart = skippedWhitespace;

	if (codeStart >= text.length) {
		return null;
	}

	// Now find the closing } that matches the {@code tag
	// We need to match braces because the code itself may contain braces
	// The opening { is at startPos (the { of {@code)
	const initialBraceCount = magicNumbers.one; // We've seen the { of {@code
	let braceCount = initialBraceCount;
	let pos = codeStart;
	const { zero } = magicNumbers;

	while (pos < text.length && braceCount > zero) {
		if (text[pos] === '{') {
			braceCount++;
		} else if (text[pos] === '}') {
			braceCount--;
		}
		pos++;
	}

	if (braceCount !== zero) {
		// Unmatched braces - preserve original
		return null;
	}

	const codeEnd = pos - magicNumbers.one; // Position before the closing }
	// Extract code and clean up comment prefixes if present
	// Multi-line code blocks may have " * " prefixes that we need to remove
	let code = text.substring(codeStart, codeEnd);

	// Remove " * " prefixes from each line if present (for already-formatted multi-line blocks)
	const codeLines = code.split('\n');
	const hasCommentPrefixes = codeLines.some((line) => /^\s*\*\s/.test(line));
	if (hasCommentPrefixes) {
		// Remove " * " prefixes and leading whitespace
		code = codeLines
			.map((line) => {
				// Remove leading whitespace and " * " prefix
				const cleaned = line.replace(/^\s*\*\s?/, '').trimStart();
				return cleaned;
			})
			.join('\n');
	}

	code = code.trim();

	return {
		code,
		endPos: pos, // Position after the closing }
	};
}

/**
 * Calculate the indentation level for a line
 * Returns the number of spaces (tabs are converted based on tabWidth)
 * Manually calculates indentation by counting leading spaces and tabs
 */
function getIndentLevel(
	line: string,
	tabWidth: number = prettierDefaultTabWidth,
): number {
	let indent = 0;
	for (const char of line) {
		if (char === ' ') {
			indent++;
		} else if (char === '\t') {
			indent += tabWidth;
		} else {
			break;
		}
	}
	return indent;
}

/**
 * Find the comment block's * alignment column
 */
function getCommentIndent(text: string, commentStart: number): number {
	// Find the first line with * after /**
	// Use prettier's skipToLineEnd to find the end of the first line (after /**)
	const lineEnd = prettier.util.skipToLineEnd(text, commentStart);
	let pos = lineEnd === false ? text.length : lineEnd;
	if (pos < text.length) {
		// Skip newline to get to the next line
		const afterNewline = prettier.util.skipNewline(text, pos);
		pos = afterNewline === false ? pos + magicNumbers.one : afterNewline;
	}
	let lineStart = commentStart;

	// Find the first * in the comment block
	while (pos < text.length) {
		if (text[pos] === '*') {
			// Found *, now find the start of this line
			lineStart = pos;
			while (
				lineStart > magicNumbers.zero &&
				text[lineStart - magicNumbers.one] !== '\n'
			) {
				lineStart--;
			}
			const line = text.substring(lineStart, pos);
			return getIndentLevel(line, prettierDefaultTabWidth);
		}
		if (text[pos] === '/' && text[pos - magicNumbers.one] === '*') {
			// Reached end of comment
			break;
		}
		pos++;
	}

	// Fallback: use the indent of the line containing /**
	lineStart = commentStart;
	while (
		lineStart > magicNumbers.zero &&
		text[lineStart - magicNumbers.one] !== '\n'
	) {
		lineStart--;
	}
	const line = text.substring(lineStart, commentStart);
	return getIndentLevel(line, prettierDefaultTabWidth);
}

/**
 * Find all {@code} blocks in ApexDoc comments
 */
export function findApexDocCodeBlocks(text: string): CodeBlock[] {
	const blocks: CodeBlock[] = [];
	const comments = findApexDocComments(text);

	for (const comment of comments) {
		const commentText = text.substring(comment.start, comment.end);
		let searchPos = 0;

		// Search for {@code within this comment
		while (searchPos < commentText.length) {
			const codeTagPos = commentText.indexOf('{@code', searchPos);
			if (codeTagPos === -magicNumbers.one) {
				break;
			}

			const absolutePos = comment.start + codeTagPos;
			const extraction = extractCodeFromBlock(commentText, codeTagPos);

			if (extraction) {
				// Calculate line number and column
				const beforeBlock = text.substring(
					magicNumbers.zero,
					absolutePos,
				);
				const lineNumber =
					(beforeBlock.match(/\n/g) ?? []).length + magicNumbers.one;
				const lastNewline = beforeBlock.lastIndexOf('\n');
				const column = absolutePos - lastNewline - magicNumbers.one;

				// Get comment indent
				const commentIndent = getCommentIndent(text, comment.start);

				blocks.push({
					startPos: absolutePos,
					endPos:
						comment.start +
						codeTagPos +
						extraction.endPos -
						codeTagPos,
					code: extraction.code,
					lineNumber,
					column,
					commentIndent,
				});

				searchPos = codeTagPos + extraction.endPos - codeTagPos;
			} else {
				// Invalid block, skip it
				searchPos = codeTagPos + magicNumbers.six; // Skip {@code
			}
		}
	}

	return blocks;
}

/**
 * Format a code block using Prettier with Apex parser
 * Uses the provided plugin to ensure List/Map formatting rules are applied
 */
export async function formatCodeBlock(
	code: Readonly<string>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	options: ParserOptions,
	plugin?: Readonly<unknown>,
): Promise<string> {
	try {
		// Wrap code in a class context so it can be parsed as valid Apex
		// This allows us to format code snippets that aren't complete files
		// If the code starts with @, it's likely an annotation, so wrap it on a method declaration
		const trimmedCode = code.trim();
		const isAnnotationCode = trimmedCode.startsWith('@');
		const wrappedCode = isAnnotationCode
			? `public class Temp { ${code} void method() {} }`
			: `public class Temp { void method() { ${code} } }`;

		// Format the code using Prettier with Apex parser
		// Use our plugin if provided (which includes the wrapped printer),
		// otherwise fall back to apexPlugin
		const plugins = plugin ? [plugin] : [apexPlugin];
		const formatted = await prettier.format(wrappedCode, {
			parser: 'apex',
			tabWidth: options.tabWidth,
			useTabs: options.useTabs,
			printWidth: options.printWidth,
			plugins,
		});

		// Extract the code from the wrapped context
		// The formatted code will be: "public class Temp {\n  void method() {\n    <code>\n  }\n}\n"
		// We need to extract just the <code> part
		const lines = formatted.split('\n');
		const codeLines: string[] = [];
		let inMethod = false;
		const { tabWidth, useTabs } = options;
		const { zero, one } = magicNumbers;

		// Find the method declaration line and calculate its indentation
		let methodIndent = zero;
		let methodBraceCount = zero; // Track nested braces to find the actual method closing brace
		let classIndent = zero;
		let inClass = false;
		for (const line of lines) {
			if (line.includes('public class Temp')) {
				classIndent = getIndentLevel(line, tabWidth);
				inClass = true;
				continue;
			}
			if (isAnnotationCode && inClass && !inMethod) {
				// For annotations, extract lines between class opening and method declaration
				if (line.includes('void method()')) {
					break;
				}
				// Skip class closing brace
				if (line.trim() === '}') {
					break;
				}
				const lineIndent = getIndentLevel(line, tabWidth);
				const codeIndent = Math.max(
					zero,
					lineIndent - classIndent - tabWidth,
				);
				const indentChar = useTabs === true ? '\t' : ' ';
				const indent =
					codeIndent > zero
						? useTabs === true
							? '\t'.repeat(Math.floor(codeIndent / tabWidth))
							: indentChar.repeat(codeIndent)
						: '';
				const codeContent = line.trimStart();
				const finalLine = indent + codeContent;
				codeLines.push(finalLine);
				continue;
			}
			if (line.includes('void method() {')) {
				// Calculate the indentation of the method declaration
				methodIndent = getIndentLevel(line, tabWidth);
				inMethod = true;
				methodBraceCount = one; // Opening brace of method
				continue;
			}
			if (inMethod) {
				// Count braces to find the actual method closing brace
				const openBraces = (line.match(/\{/g) ?? []).length;
				const closeBraces = (line.match(/\}/g) ?? []).length;
				methodBraceCount += openBraces - closeBraces;

				// If we've closed all braces and this line only has the closing brace (no code),
				// this is the method's closing brace
				if (methodBraceCount === zero && line.trim() === '}') {
					break;
				}
			}
			if (inMethod) {
				// Remove the method-level indentation to get the raw code
				// The code inside the method will have methodIndent + tabWidth spaces
				const lineIndent = getIndentLevel(line, tabWidth);
				const codeIndent = Math.max(
					zero,
					lineIndent - methodIndent - tabWidth,
				);

				// Reconstruct the line with only the code-level indentation
				// This preserves the relative indentation of the formatted code
				const indentChar = useTabs === true ? '\t' : ' ';
				const indent =
					codeIndent > zero
						? useTabs === true
							? '\t'.repeat(Math.floor(codeIndent / tabWidth))
							: indentChar.repeat(codeIndent)
						: '';
				const codeContent = line.trimStart();
				const finalLine = indent + codeContent;
				codeLines.push(finalLine);
			}
		}

		return codeLines.join('\n').trimEnd();
	} catch {
		// If formatting fails, preserve original code
		// Return a special marker to indicate formatting failed
		// We'll use a prefix that's unlikely to appear in real code
		return `__FORMAT_FAILED__${code}`;
	}
}

/**
 * Apply proper indentation to formatted code within a comment block
 * Each line should be prefixed with " * " to align with the comment block
 */
export function applyCommentIndentation(
	formattedCode: Readonly<string>,
	codeBlock: ReadonlyCodeBlock,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
	options: ParserOptions,
): string {
	const { tabWidth, useTabs } = options;

	// Calculate the base indentation for the comment block
	// This is where the * appears in the comment
	const { commentIndent } = codeBlock;

	// Split formatted code into lines
	const lines = formattedCode.split('\n');
	if (lines.length === magicNumbers.zero) {
		return '';
	}

	const indentedLines = lines.map((line) => {
		if (line.trim() === '') {
			// Empty lines should just have the comment prefix
			const indent =
				useTabs === true
					? '\t'.repeat(Math.floor(commentIndent / tabWidth))
					: ' '.repeat(commentIndent);
			return indent + ' *';
		}

		// Calculate the indent level of the code line (before trimming)
		// This represents the relative indentation of the code inside the {@code} block
		const codeIndentLevel = getIndentLevel(line, tabWidth);

		// Formula: INDENT LEVEL OF COMMENT BLOCK + ' * ' + INDENT LEVEL OF CODE INSIDE {@code} BLOCK
		// Build the base indent for the comment block (where * appears)
		const commentBlockIndent =
			useTabs === true
				? '\t'.repeat(Math.floor(commentIndent / tabWidth))
				: ' '.repeat(commentIndent);

		// Add the comment prefix " * "
		const commentPrefix = commentBlockIndent + ' * ';

		// Add the code's indent level (the relative indent of the code inside {@code} block)
		const codeIndent =
			codeIndentLevel > magicNumbers.zero
				? useTabs === true
					? '\t'.repeat(Math.floor(codeIndentLevel / tabWidth))
					: ' '.repeat(codeIndentLevel)
				: '';

		// Get the code content (without leading whitespace, since we've already accounted for it)
		const codeContent = line.trimStart();

		// Combine: comment indent + " * " + code indent + code content
		return commentPrefix + codeIndent + codeContent;
	});

	return indentedLines.join('\n');
}
