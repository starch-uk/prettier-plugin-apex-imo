/**
 * @file Utility functions for text wrapping and formatting using Prettier's doc builders.
 */

import type { Doc, ParserOptions } from 'prettier';
import * as prettier from 'prettier';

/**
 * Wraps text content using Prettier's fill builder and returns a Doc.
 * This allows direct integration with Prettier's doc composition system.
 * @param text - The text content to wrap.
 * @returns A Prettier Doc that can be used in doc composition.
 * @example
 * ```typescript
 * const doc = wrapTextWithFill('Some long text that should be wrapped');
 * ```
 */
const wrapTextWithFill = (text: string): Doc => {
	if (!text || text.trim().length === 0) {
		return '';
	}
	const words = text.split(/\s+/).filter((word) => word.length > 0);
	if (words.length === 0) {
		return '';
	}
	const { fill, join, line } = prettier.doc.builders;
	return fill(join(line, words));
};

/**
 * Calculates the effective width available for content after accounting for indentation.
 * @param printWidth - The total print width from options.
 * @param prefixLength - The length of the prefix (e.g., comment markers, indentation).
 * @returns The effective width available for content.
 * @example
 * ```typescript
 * const effectiveWidth = calculateEffectiveWidth(80, 6); // Returns 74
 * ```
 */
const calculateEffectiveWidth = (
	printWidth: number,
	prefixLength: number,
): number => {
	return Math.max(0, printWidth - prefixLength);
};

/**
 * Wraps text content with fill and applies indentation based on prefix length.
 * This is useful for formatting content within indented contexts like comments.
 * @param text - The text content to wrap.
 * @param prefixLength - The length of the prefix that will be added.
 * @param options - Parser options containing printWidth and other formatting settings.
 * @returns A Prettier Doc with appropriate wrapping and indentation.
 * @example
 * ```typescript
 * const doc = wrapTextWithFillAndIndent('Long comment text', 6, options);
 * ```
 */
const wrapTextWithFillAndIndent = (
	text: string,
	prefixLength: number,
	options: Readonly<ParserOptions>,
): Doc => {
	if (!text || text.trim().length === 0) {
		return '';
	}

	const { printWidth = 80 } = options;
	const effectiveWidth = calculateEffectiveWidth(printWidth, prefixLength);

	// If the text is short enough to fit, return it as-is
	if (text.length <= effectiveWidth) {
		return text;
	}

	// Use fill to wrap the text appropriately
	return wrapTextWithFill(text);
};

/**
 * Splits text into words for wrapping, preserving whitespace structure.
 * @param text - The text to split into words.
 * @returns Array of words, filtering out empty strings.
 * @example
 * ```typescript
 * const words = splitTextIntoWords('Hello   world'); // Returns ['Hello', 'world']
 * ```
 */
const splitTextIntoWords = (text: string): string[] => {
	return text.split(/\s+/).filter((word) => word.length > 0);
};

/**
 * Checks if text needs wrapping based on length and print width.
 * @param text - The text to check.
 * @param printWidth - The maximum allowed width.
 * @returns True if the text needs wrapping, false otherwise.
 * @example
 * ```typescript
 * const needsWrap = shouldWrapText('Very long text here', 40); // Returns true
 * ```
 */
const shouldWrapText = (text: string, printWidth: number): boolean => {
	return text.length > printWidth;
};

export {
	wrapTextWithFill,
	calculateEffectiveWidth,
	wrapTextWithFillAndIndent,
	splitTextIntoWords,
	shouldWrapText,
};