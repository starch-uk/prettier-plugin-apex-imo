/**
 * @file Helper functions for text processing and formatting.
 * Provides utilities for comment text manipulation and width calculations.
 */

import type { ParserOptions } from 'prettier';

/**
 * Removes comment prefix (asterisk and spaces) from a line.
 * @param line - Line to remove prefix from.
 * @param preserveIndent - If true, uses original regex without trim to preserve code indentation. Otherwise trims result.
 * @returns Line with prefix removed and optionally trimmed.
 */
export const removeCommentPrefix = (
	line: string,
	preserveIndent: boolean = false,
): string => {
	// Use original regex: /^\s*(\*(\s*\*)*)\s*/ - removes leading whitespace, asterisk(s), and all trailing whitespace
	const result = line.replace(/^\s*(\*(\s*\*)*)\s*/, '');
	return preserveIndent ? result : result.trim();
};

/**
 * Normalizes comment start marker: /***** -> /**
 * @param comment - The comment string to normalize.
 * @returns The normalized comment with corrected start marker.
 */
export const normalizeCommentStart = (comment: string): string => {
	// Find first non-whitespace character
	let start = 0;
	while (
		start < comment.length &&
		(comment[start] === ' ' || comment[start] === '\t')
	) {
		start++;
	}
	// If we find /*, normalize multiple asterisks
	if (comment.substring(start).startsWith('/*')) {
		const prefix = comment.substring(0, start);
		const afterSlash = comment.substring(start + 1);
		// Count asterisks after /
		let asteriskCount = 0;
		while (
			asteriskCount < afterSlash.length &&
			afterSlash[asteriskCount] === '*'
		) {
			asteriskCount++;
		}
		// Normalize to exactly two asterisks (/**)
		if (asteriskCount > 2) {
			return prefix + '/**' + afterSlash.substring(asteriskCount);
		} else if (asteriskCount === 1) {
			// Only one asterisk, need to add one more
			return prefix + '/**' + afterSlash.substring(1);
		}
	}
	return comment;
};

/**
 * Normalizes comment end marker: multiple asterisks before slash to single asterisk.
 * @param comment - The comment string to normalize.
 * @returns The normalized comment with corrected end marker.
 */
export const normalizeCommentEnd = (comment: string): string => {
	// Replace **/ or more with */ - scan for patterns and replace
	let result = comment;
	let pos = 0;
	while (pos < result.length) {
		// Look for */ pattern
		const slashPos = result.indexOf('/', pos);
		if (slashPos === -1) break;

		// Count asterisks before /
		let asteriskCount = 0;
		let checkPos = slashPos - 1;
		while (checkPos >= 0 && result[checkPos] === '*') {
			asteriskCount++;
			checkPos--;
		}

		// If we have 2+ asterisks before /, normalize to */
		if (asteriskCount >= 2) {
			const replaceStart = checkPos + 1;
			result =
				result.substring(0, replaceStart) +
				'*/' +
				result.substring(slashPos + 1);
			pos = replaceStart + 2;
		} else {
			pos = slashPos + 1;
		}
	}
	return result;
};

/**
 * Calculates the effective print width accounting for comment formatting.
 * Subtracts indentation and comment prefix length from total print width.
 * @param options - Parser options containing printWidth, tabWidth, and useTabs.
 * @param baseIndent - The base indentation level in spaces.
 * @param includeCommentPrefix - Whether to account for comment prefix (* ) in calculation.
 * @returns The effective print width for content within comments.
 */
export const calculateEffectivePrintWidth = (
	options: Readonly<ParserOptions>,
	baseIndent: number = 0,
	includeCommentPrefix: boolean = true,
): number => {
	const printWidth = options.printWidth || 80;
	const tabWidth = options.tabWidth || 2;

	// Calculate indentation string length
	let indentLength = baseIndent;
	if (options.useTabs) {
		indentLength = Math.floor(baseIndent / tabWidth) * tabWidth;
	}

	// Add comment prefix length if requested
	if (includeCommentPrefix) {
		indentLength += ' * '.length; // space + asterisk + space
	}

	// Ensure minimum width
	return Math.max(20, printWidth - indentLength);
};