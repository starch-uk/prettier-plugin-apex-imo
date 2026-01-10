/**
 * @file Utility functions for comment processing and validation.
 */

import type { ApexNode } from '../types.js';

/**
 * Checks if a comment node is an Apex comment.
 * This identifies comments that can have ApexDoc annotations and formatting.
 * @param comment - The comment node to check.
 * @returns True if the comment is an Apex comment, false otherwise.
 */
const isApexComment = (comment: unknown): boolean => {
	if (
		comment === null ||
		comment === undefined ||
		typeof comment !== 'object' ||
		!('value' in comment) ||
		typeof (comment as { value?: unknown }).value !== 'string'
	) {
		return false;
	}
	const commentValue = (comment as { value: string }).value;
	// Must start with /** and end with */ (ApexDoc style)
	if (
		!commentValue.trimStart().startsWith('/**') ||
		!commentValue.trimEnd().endsWith('*/')
	) {
		return false;
	}
	return true;
};

/**
 * Safely extracts a comment node from an unknown type.
 * This is used by comment handling functions to ensure type safety.
 * @param comment - The unknown comment to extract.
 * @returns The comment node if valid, null otherwise.
 */
const getCommentNode = (
	comment: unknown,
): { value: string; '@class'?: string } | null => {
	if (!isApexComment(comment)) {
		return null;
	}
	return comment as { value: string; '@class'?: string };
};

/**
 * Checks if a comment is an ApexDoc comment using Prettier patterns.
 * This is more lenient than isApexComment and allows for malformed comments
 * that should still be treated as ApexDoc for normalization purposes.
 * @param comment - The comment node to check.
 * @returns True if the comment should be treated as ApexDoc, false otherwise.
 */
const isApexDocComment = (comment: unknown): boolean => {
	if (
		comment === null ||
		comment === undefined ||
		typeof comment !== 'object' ||
		!('value' in comment) ||
		typeof (comment as { value?: unknown }).value !== 'string'
	) {
		return false;
	}
	const commentValue = (comment as { value: string }).value;
	// Must start with /** and end with */
	if (
		!commentValue.trimStart().startsWith('/**') ||
		!commentValue.trimEnd().endsWith('*/')
	) {
		return false;
	}

	const lines = commentValue.split('\n');
	// For well-formed ApexDoc, all middle lines should have asterisks
	// For malformed ApexDoc, we still want to detect it if it starts with /** and ends with */
	// If it has at least one middle line with an asterisk, treat it as ApexDoc
	// If it has NO asterisks but starts with /** and ends with */, also treat it as ApexDoc
	// (so we can normalize it by adding asterisks)
	if (lines.length <= 1) return false;
	const middleLines = lines.slice(1, lines.length - 1);
	// If at least one middle line has an asterisk, treat it as ApexDoc (even if malformed)
	for (const commentLine of middleLines) {
		if (commentLine.trim().startsWith('*')) {
			return true;
		}
	}
	// If no middle lines have asterisks but comment starts with /** and ends with */,
	// treat it as ApexDoc so we can normalize it (add asterisks)
	return middleLines.length > 0;
};

/**
 * Extracts the comment value from a comment node safely.
 * @param comment - The comment node to extract value from.
 * @returns The comment value string, or null if invalid.
 */
const extractCommentValue = (comment: unknown): string | null => {
	const commentNode = getCommentNode(comment);
	return commentNode ? commentNode.value : null;
};

/**
 * Checks if a comment node has location information for attachment.
 * @param comment - The comment node to check.
 * @returns True if the comment has location data for attachment.
 */
const hasCommentLocation = (comment: unknown): comment is ApexNode & { loc?: unknown } => {
	if (!comment || typeof comment !== 'object') return false;
	const commentWithLoc = comment as { loc?: unknown; '@class'?: unknown };
	return !!commentWithLoc.loc && !!commentWithLoc['@class'];
};

export {
	isApexComment,
	getCommentNode,
	isApexDocComment,
	extractCommentValue,
	hasCommentLocation,
};