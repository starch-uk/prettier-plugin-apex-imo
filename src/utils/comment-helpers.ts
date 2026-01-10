/**
 * @file Helper functions for comment detection and processing.
 * Provides utilities for identifying and working with Apex comments.
 */

import type { ApexNode } from '../types.js';
import { getNodeClassOptional } from '../utils.js';

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
 * Checks if a comment is an ApexDoc comment with more sophisticated logic.
 * This function handles both well-formed and malformed ApexDoc comments.
 * @param comment - The comment node to check.
 * @returns True if the comment is an ApexDoc comment, false otherwise.
 */
export const isApexDoc = (comment: unknown): boolean => {
	if (
		comment === null ||
		comment === undefined ||
		typeof comment !== 'object' ||
		!('value' in comment) ||
		typeof (comment as { value: unknown }).value !== 'string'
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
 * Checks if a node is valid for comment attachment.
 * This is an enhanced version that uses node class checking for better accuracy.
 * @param node - The node to check.
 * @returns True if the node can have comments attached, false otherwise.
 */
export const isValidNodeForComments = (node: unknown): boolean => {
	if (!node || typeof node !== 'object') return false;

	const nodeWithClass = node as { loc?: unknown; '@class'?: unknown };
	if (!nodeWithClass.loc) return false;

	const nodeClass = getNodeClassOptional(node as ApexNode);
	if (!nodeClass) return false;

	// Define node types that can have comments attached
	const ALLOW_COMMENT_ATTACHMENT = new Set([
		'apex.jorje.data.ast.ClassDeclaration',
		'apex.jorje.data.ast.InterfaceDeclaration',
		'apex.jorje.data.ast.EnumDeclaration',
		'apex.jorje.data.ast.MethodDeclaration',
		'apex.jorje.data.ast.FieldDeclaration',
		'apex.jorje.data.ast.VariableDecls',
		'apex.jorje.data.ast.Stmnt$ExpressionStmnt',
		'apex.jorje.data.ast.Stmnt$BlockStmnt',
		'apex.jorje.data.ast.Stmnt$IfStmnt',
		'apex.jorje.data.ast.Stmnt$ForStmnt',
		'apex.jorje.data.ast.Stmnt$WhileStmnt',
		'apex.jorje.data.ast.Stmnt$ReturnStmnt',
	]);

	return ALLOW_COMMENT_ATTACHMENT.has(nodeClass);
};