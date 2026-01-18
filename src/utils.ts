/**
 * @file Utility functions for working with Apex AST nodes.
 */

import type { ParserOptions } from 'prettier';
import * as prettier from 'prettier';
import type { ApexNode } from './types.js';
import { DECLARATION_MODIFIERS_SET } from './refs/reserved-words.js';
import { normalizeInlineCommentsInCode } from './comments.js';

/**
 * Shared Prettier doc builders for consistent usage across the codebase.
 * Reduces duplication of prettier.doc.builders destructuring.
 */
const docBuilders = prettier.doc.builders;

const getNodeClass = (node: Readonly<ApexNode>): string => node['@class'];

const getNodeClassOptional = (node: Readonly<ApexNode>): string | undefined => {
	const cls = node['@class'];
	return typeof cls === 'string' ? cls : undefined;
};

/**
 * Checks if a value is a non-null object.
 * @param value - The value to check.
 * @returns True if the value is a non-null object.
 */
const isObject = (value: unknown): value is object =>
	value !== null && typeof value === 'object';

/**
 * Checks if a value is an object-like structure with a '@class' property.
 * @param value - The value to check.
 * @returns True if the value is an object with a '@class' property.
 */
const isApexNodeLike = (
	value: unknown,
): value is { [key: string]: unknown; '@class': unknown } =>
	isObject(value) && '@class' in value;

/**
 * Creates a type guard factory for AST nodes based on class name.
 * @param className - The exact class name to match, or a function that checks the class name.
 * @returns A type guard function.
 */
const createNodeClassGuard = <T extends ApexNode>(
	className: string | ((cls: string | undefined) => boolean),
) => {
	const checkClass =
		typeof className === 'string'
			? (cls: string | undefined): boolean => cls === className
			: className;

	return (
		node: Readonly<ApexNode> | null | undefined,
	): node is Readonly<T> => {
		if (!isObject(node)) return false;
		const nodeClass = getNodeClassOptional(node);
		return checkClass(nodeClass);
	};
};

const startsWithAccessModifier = (line: Readonly<string>): boolean => {
	const trimmed = line.trim();
	const ZERO_LENGTH = 0;
	if (trimmed.length === ZERO_LENGTH) return false;
	// Use character scanning instead of regex to find first whitespace
	const NOT_FOUND = -1;
	const ZERO_INDEX = 0;
	let spaceIndex = NOT_FOUND;
	for (let i = ZERO_INDEX; i < trimmed.length; i++) {
		const char = trimmed[i];
		if (char === ' ' || char === '\t') {
			spaceIndex = i;
			break;
		}
	}
	const firstWord = (
		spaceIndex === NOT_FOUND
			? trimmed
			: trimmed.slice(ZERO_INDEX, spaceIndex)
	).toLowerCase();
	return DECLARATION_MODIFIERS_SET.has(firstWord);
};

const EMPTY = 0;
const ARRAY_START_INDEX = 0;
const INDEX_ONE = 1;
const STRING_OFFSET = 1;

/**
 * Checks if a value is empty (string or array).
 * @param value - The value to check.
 * @returns True if the value is empty.
 */
const isEmpty = (value: Readonly<unknown[] | string>): boolean =>
	value.length === EMPTY;

/**
 * Checks if a value is not empty (string or array).
 * @param value - The value to check.
 * @returns True if the value is not empty.
 */
const isNotEmpty = (value: Readonly<unknown[] | string>): boolean =>
	value.length > EMPTY;

/**
 * Calculates effective width by subtracting comment prefix length from print width.
 * Computes the available width for content by subtracting the comment prefix length from the total print width.
 * Throws an error if printWidth is undefined.
 * @param printWidth - The print width option.
 * @param commentPrefixLength - The length of the comment prefix to subtract from print width.
 * @returns The effective width available for content after accounting for prefix.
 * @throws {Error} If printWidth is undefined, indicating invalid configuration.
 */
const calculateEffectiveWidth = (
	printWidth: number | undefined,
	commentPrefixLength: number,
): number => {
	if (printWidth === undefined) {
		throw new Error(
			'prettier-plugin-apex-imo: printWidth is required for calculateEffectiveWidth',
		);
	}
	return printWidth - commentPrefixLength;
};

/**
 * Determines if a blank line should be preserved after a closing brace.
 * Checks if the current line ends with '}' and the next line starts with '@' or an access modifier.
 * @param formattedLines - Array of formatted lines.
 * @param index - Current line index.
 * @returns True if a blank line should be preserved.
 */
const preserveBlankLineAfterClosingBrace = (
	formattedLines: Readonly<readonly string[]>,
	index: number,
): boolean => {
	const ZERO_INDEX = 0;
	const INDEX_OFFSET = 1;
	if (
		index < ZERO_INDEX ||
		index >= formattedLines.length ||
		index + INDEX_OFFSET >= formattedLines.length
	) {
		return false;
	}
	const currentLine = formattedLines[index];
	if (currentLine === undefined) return false;
	const trimmedLine = currentLine.trim();
	if (!trimmedLine.endsWith('}')) {
		return false;
	}

	const nextLine = formattedLines[index + INDEX_OFFSET]?.trim();
	const hasNextLine = nextLine !== undefined && nextLine !== '';
	if (!hasNextLine || isEmpty(nextLine)) {
		return false;
	}
	return nextLine.startsWith('@') || startsWithAccessModifier(nextLine);
};

/**
 * Formats Apex code using prettier with parser fallback.
 * Tries 'apex-anonymous' parser first, then falls back to 'apex' parser.
 * If both fail, returns the original code.
 *
 * Note: Annotations are normalized via AST during printing (see printAnnotation in annotations.ts).
 * The wrapped printer intercepts annotation nodes and normalizes them, so no string-based
 * normalization fallback is needed.
 * @param code - The code to format.
 * @param options - Parser options including printWidth, tabWidth, useTabs, and plugins.
 * @param formatFn - Optional format function (for testing). Defaults to prettier.format.
 * @returns Promise resolving to formatted code string, or the original code if both parsers fail.
 */
const formatApexCodeWithFallback = async (
	code: Readonly<string>,
	// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Options type is already Readonly wrapper
	options: Readonly<ParserOptions & { plugins?: unknown[] }>,
	formatFn: (
		code: Readonly<string>,
		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Function parameter type doesn't need readonly wrapper
		opts?: Readonly<
			ParserOptions & { parser?: string; plugins?: unknown[] }
		>,
	) => Promise<string> = prettier.format,
): Promise<string> => {
	try {
		const result = await formatFn(code, {
			...options,
			parser: 'apex-anonymous',
		});
		// Annotations are already normalized via AST during printing (see printAnnotation in annotations.ts)
		// Normalize inline comments to have exactly one space between // and content
		return normalizeInlineCommentsInCode(result);
	} catch {
		try {
			const result = await formatFn(code, {
				...options,
				parser: 'apex',
			});
			// Annotations are already normalized via AST during printing (see printAnnotation in annotations.ts)
			// Normalize inline comments to have exactly one space between // and content
			return normalizeInlineCommentsInCode(result);
		} catch {
			return code;
		}
	}
};

export {
	getNodeClass,
	getNodeClassOptional,
	createNodeClassGuard,
	startsWithAccessModifier,
	ARRAY_START_INDEX,
	EMPTY,
	INDEX_ONE,
	STRING_OFFSET,
	isEmpty,
	isNotEmpty,
	isObject,
	isApexNodeLike,
	calculateEffectiveWidth,
	preserveBlankLineAfterClosingBrace,
	formatApexCodeWithFallback,
	docBuilders,
};
