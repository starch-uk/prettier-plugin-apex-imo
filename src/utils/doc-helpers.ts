/**
 * @file Helper functions for Prettier doc builders. Provides common patterns and utilities
 * for working with Prettier's document system in a consistent way.
 */

import type { Doc } from 'prettier';
import { doc } from 'prettier';
const { group, indent, ifBreak, line, softline, join } = doc.builders;

/**
 * Creates a grouped doc that indents content on break.
 * Common pattern: `group(indent([softline, ...content]))`
 * @param content - The content to group and indent
 * @returns A grouped doc with conditional indentation
 */
export const createGroupedIndentedDoc = (content: Doc[]): Doc =>
	group(indent([softline, ...content]));

/**
 * Creates a breakable assignment expression doc.
 * Common pattern for assignments: `group([left, ' ', '=', ifBreak(indent([line, right]), [space, right])])`
 * @param left - Left side of assignment
 * @param right - Right side of assignment
 * @returns A grouped assignment doc with proper break handling
 */
export const createBreakableAssignmentDoc = (left: Doc, right: Doc): Doc =>
	group([
		left,
		' ',
		'=',
		ifBreak(indent([line, right]), [' ', right]),
	]);

/**
 * Creates a breakable doc that wraps content in conditional indentation.
 * Common pattern: `ifBreak(indent([line, content]), [space, content])`
 * @param content - The content to make breakable
 * @returns A breakable doc with conditional indentation
 */
export const createBreakableDoc = (content: Doc): Doc =>
	ifBreak(indent([line, content]), [' ', content]);

/**
 * Creates a doc from an array of parts with proper grouping.
 * Common pattern: `group(parts)` for combining multiple doc parts
 * @param parts - Array of doc parts to group
 * @returns A grouped doc
 */
export const createGroupedDoc = (parts: Doc[]): Doc => group(parts);

/**
 * Creates an indented doc.
 * Common pattern: `indent(content)` for indenting content
 * @param content - The content to indent
 * @returns An indented doc
 */
export const createIndentedDoc = (content: Doc[]): Doc => indent(content);

/**
 * Creates a doc that joins elements with separators and optional line breaks.
 * Common pattern: `join([separator, softline], items)`
 * @param items - Items to join
 * @param separator - Separator between items (default: ', ')
 * @param withSoftline - Whether to include softline breaks (default: true)
 * @returns A joined doc
 */
export const createJoinedDoc = (
	items: Doc[],
	separator: string | Doc = ', ',
	withSoftline = true,
): Doc => {
	if (withSoftline) {
		return join([separator, softline], items);
	}
	return join(separator, items);
};

/**
 * Creates a doc that handles line wrapping for type parameters.
 * Common pattern for generic types: `group([baseType, '<', join([', ', softline], params), '>'])`
 * @param baseType - The base type name
 * @param typeParams - Array of type parameters
 * @returns A grouped generic type doc
 */
export const createGenericTypeDoc = (baseType: Doc, typeParams: Doc[]): Doc =>
	group([baseType, '<', join([', ', softline], typeParams), '>']);

/**
 * Creates a doc that handles line wrapping for map types.
 * Common pattern for map types: `group(['Map<', join([', ', softline], params), '>'])`
 * @param keyType - Key type parameter
 * @param valueType - Value type parameter
 * @returns A grouped map type doc
 */
export const createMapTypeDoc = (keyType: Doc, valueType: Doc): Doc =>
	group(['Map<', join([', ', softline], [keyType, valueType]), '>']);