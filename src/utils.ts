/**
 * @file Utility functions for working with Apex AST nodes.
 */

import type { ApexNode } from './types.js';
import type { ParserOptions } from 'prettier';
import * as prettier from 'prettier';
import { DECLARATION_MODIFIERS_SET } from './refs/reserved-words.js';

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
	const spaceIndex = trimmed.search(/\s/);
	const firstWord = (
		spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)
	).toLowerCase();
	return DECLARATION_MODIFIERS_SET.has(firstWord);
};

const EMPTY = 0;

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
	const DEFAULT_PRINT_WIDTH = 80;
	return (printWidth ?? DEFAULT_PRINT_WIDTH) - commentPrefixLength;
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
	const currentLine = formattedLines[index] ?? '';
	const trimmedLine = currentLine.trim();
	const nextIndex = index + 1;

	if (
		!trimmedLine.endsWith('}') ||
		nextIndex >= formattedLines.length
	) {
		return false;
	}

	const nextLine = formattedLines[nextIndex]?.trim() ?? '';
	return (
		isNotEmpty(nextLine) &&
		(nextLine.startsWith('@') || startsWithAccessModifier(nextLine))
	);
};

/**
 * Formats Apex code using prettier with parser fallback.
 * Tries 'apex-anonymous' parser first, then falls back to 'apex' parser.
 * If both fail, returns the original code.
 * @param code - The code to format.
 * @param options - Parser options including printWidth, tabWidth, useTabs, and plugins.
 * @returns Promise resolving to formatted code string.
 */
const formatApexCodeWithFallback = async (
	code: string,
	options: Readonly<ParserOptions & { plugins?: unknown[] }>,
): Promise<string> => {
	try {
		return await prettier.format(code, {
			...options,
			parser: 'apex-anonymous',
		});
	} catch {
		try {
			return await prettier.format(code, {
				...options,
				parser: 'apex',
			});
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
	EMPTY,
	isEmpty,
	isNotEmpty,
	calculateEffectiveWidth,
	preserveBlankLineAfterClosingBrace,
	formatApexCodeWithFallback,
};
