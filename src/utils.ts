/**
 * @file Utility functions for working with Apex AST nodes.
 */

import type { ApexNode } from './types.js';
import type { ParserOptions } from 'prettier';
import * as prettier from 'prettier';
import { DECLARATION_MODIFIERS_SET } from './refs/reserved-words.js';

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
		if (!node || typeof node !== 'object') return false;
		const nodeClass = getNodeClassOptional(node);
		return checkClass(nodeClass);
	};
};

const startsWithAccessModifier = (line: string): boolean => {
	const trimmed = line.trim();
	if (trimmed.length === 0) return false;
	// Use character scanning instead of regex to find first whitespace
	let spaceIndex = -1;
	for (let i = 0; i < trimmed.length; i++) {
		const char = trimmed[i];
		if (char === ' ' || char === '\t') {
			spaceIndex = i;
			break;
		}
	}
	const firstWord = (
		spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)
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
const isEmpty = (value: string | unknown[]): boolean => value.length === EMPTY;

/**
 * Checks if a value is not empty (string or array).
 * @param value - The value to check.
 * @returns True if the value is not empty.
 */
const isNotEmpty = (value: string | unknown[]): boolean => value.length > EMPTY;

/**
 * Calculates effective width by subtracting comment prefix length from print width.
 * @param printWidth - The print width option.
 * @param commentPrefixLength - The length of the comment prefix.
 * @returns The effective width available for content.
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
	formattedLines: readonly string[],
	index: number,
): boolean => {
	if (
		index < 0 ||
		index >= formattedLines.length ||
		index + 1 >= formattedLines.length
	) {
		return false;
	}
	const currentLine = formattedLines[index];
	if (currentLine === undefined) return false;
	const trimmedLine = currentLine.trim();
	if (!trimmedLine.endsWith('}')) {
		return false;
	}

	const nextLine = formattedLines[index + 1]?.trim();
	if (!nextLine || isEmpty(nextLine)) {
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
 * 
 * @param code - The code to format.
 * @param options - Parser options including printWidth, tabWidth, useTabs, and plugins.
 * @returns Promise resolving to formatted code string.
 */
const formatApexCodeWithFallback = async (
	code: string,
	options: Readonly<ParserOptions & { plugins?: unknown[] }>,
): Promise<string> => {
	try {
		const result = await prettier.format(code, {
			...options,
			parser: 'apex-anonymous',
		});
		// Annotations are already normalized via AST during printing (see printAnnotation in annotations.ts)
		return result;
	} catch {
		try {
			const result = await prettier.format(code, {
				...options,
				parser: 'apex',
			});
			// Annotations are already normalized via AST during printing (see printAnnotation in annotations.ts)
			return result;
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
	calculateEffectiveWidth,
	preserveBlankLineAfterClosingBrace,
	formatApexCodeWithFallback,
	docBuilders,
};
