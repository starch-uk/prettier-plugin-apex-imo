/**
 * @file Utility functions for comment detection and validation.
 */

import type { ApexNode } from '../types.js';

// Constants
const ARRAY_START_INDEX = 0;
const INDEX_ONE = 1;

/**
 * Checks if a comment node is an Apex comment.
 * This identifies comments that can have ApexDoc annotations and formatting.
 * @param comment - The comment node to check.
 * @returns True if the comment is an Apex comment, false otherwise.
 */
export const isApexComment = (comment: unknown): boolean => {
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
export const getCommentNode = (
	comment: unknown,
): { value: string; '@class'?: string } | null => {
	if (!isApexComment(comment)) {
		return null;
	}
	return comment as { value: string; '@class'?: string };
};

/**
 * Checks if a comment is an ApexDoc comment.
 * This is more specific than isApexComment - it checks for actual ApexDoc content.
 * @param comment - The comment node to check.
 * @returns True if the comment is an ApexDoc comment, false otherwise.
 */
export const isApexDoc = (comment: unknown): boolean => {
	if (
		comment === null ||
		comment === undefined ||
		typeof comment !== 'object' ||
		!('value' in comment) ||
		typeof comment.value !== 'string'
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
	if (lines.length <= INDEX_ONE) return false;
	const middleLines = lines.slice(INDEX_ONE, lines.length - INDEX_ONE);
	// If at least one middle line has an asterisk, treat it as ApexDoc (even if malformed)
	for (const commentLine of middleLines) {
		if (commentLine.trim().startsWith('*')) {
			return true;
		}
	}
	// If no middle lines have asterisks but comment starts with /** and ends with */,
	// treat it as ApexDoc so we can normalize it (add asterisks)
	return middleLines.length > ARRAY_START_INDEX;
};

/**
 * Checks if a comment is valid for processing.
 * This combines basic validation with content checks.
 * @param comment - The comment node to check.
 * @returns True if the comment can be processed, false otherwise.
 */
export const isValidCommentForProcessing = (comment: unknown): boolean => {
	if (!isApexComment(comment)) {
		return false;
	}

	const commentNode = getCommentNode(comment);
	if (!commentNode) {
		return false;
	}

	// Must have non-empty content
	const trimmedValue = commentNode.value.trim();
	return trimmedValue.length > 0;
};

/**
 * Apex AST node types that allow dangling comments.
 */
export const ALLOW_DANGLING_COMMENTS = [
	'apex.jorje.data.ast.ClassDeclaration',
	'apex.jorje.data.ast.InterfaceDeclaration',
	'apex.jorje.data.ast.EnumDeclaration',
	'apex.jorje.data.ast.TriggerDeclarationUnit',
	'apex.jorje.data.ast.Stmnt$BlockStmnt',
];

/**
 * Checks if an AST node allows dangling comments.
 * @param nodeClass - The AST node class name.
 * @returns True if the node allows dangling comments, false otherwise.
 */
export const allowsDanglingComments = (nodeClass: string | undefined): boolean => {
	if (!nodeClass) {
		return false;
	}
	return ALLOW_DANGLING_COMMENTS.includes(nodeClass);
};