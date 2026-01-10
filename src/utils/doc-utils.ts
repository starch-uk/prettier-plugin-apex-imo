/**
 * @file Utility functions for common Prettier doc builder patterns.
 */

import type { Doc } from 'prettier';
import * as prettier from 'prettier';

const { group, indent, ifBreak, join, line, softline, hardline } = prettier.doc.builders;

/**
 * Creates a grouped document with optional indentation.
 * @param docs - The documents to group.
 * @param shouldIndent - Whether to indent the grouped content (default: false).
 * @returns A grouped document.
 * @example
 * ```typescript
 * createGroupedDoc([nameDoc, ' = ', valueDoc], true)
 * ```
 */
export const createGroupedDoc = (
	docs: Doc[],
	shouldIndent: boolean = false,
): Doc => {
	const content = shouldIndent ? indent(docs) : docs;
	return group(content);
};

/**
 * Creates an indented document.
 * @param docs - The documents to indent.
 * @param shouldGroup - Whether to wrap the indented content in a group (default: false).
 * @returns An indented document.
 * @example
 * ```typescript
 * createIndentedDoc([line, assignmentDoc])
 * ```
 */
export const createIndentedDoc = (
	docs: Doc[],
	shouldGroup: boolean = false,
): Doc => {
	const content = indent(docs);
	return shouldGroup ? group(content) : content;
};

/**
 * Creates a fill document for text wrapping.
 * @param content - The content to wrap.
 * @param separator - The separator to use between words (default: line).
 * @returns A fill document.
 * @example
 * ```typescript
 * createFillDoc(words, line)
 * ```
 */
export const createFillDoc = (
	content: string | Doc[],
	separator: Doc = line,
): Doc => {
	if (typeof content === 'string') {
		const words = content.split(/\s+/).filter((word) => word.length > 0);
		return prettier.doc.builders.fill(join(separator, words));
	}
	return prettier.doc.builders.fill(content);
};

/**
 * Creates a conditional break document.
 * @param breakDoc - The document to use when breaking.
 * @param flatDoc - The document to use when not breaking.
 * @returns A conditional break document.
 * @example
 * ```typescript
 * createConditionalBreak(indent([line, content]), [' ', content])
 * ```
 */
export const createConditionalBreak = (breakDoc: Doc, flatDoc: Doc): Doc => {
	return ifBreak(breakDoc, flatDoc);
};

/**
 * Creates a joined document with a separator.
 * @param docs - The documents to join.
 * @param separator - The separator to use between documents.
 * @returns A joined document.
 * @example
 * ```typescript
 * createJoinedDoc([item1, item2, item3], [',', line])
 * ```
 */
export const createJoinedDoc = (docs: Doc[], separator: Doc): Doc => {
	return join(separator, docs);
};

/**
 * Creates a document with proper line breaks for assignments.
 * @param leftDoc - The left side of the assignment.
 * @param rightDoc - The right side of the assignment.
 * @param operator - The assignment operator (default: '=').
 * @returns A properly formatted assignment document.
 * @example
 * ```typescript
 * createAssignmentDoc(nameDoc, valueDoc, '=')
 * ```
 */
export const createAssignmentDoc = (
	leftDoc: Doc,
	rightDoc: Doc,
	operator: string = '=',
): Doc => {
	return createGroupedDoc([
		leftDoc,
		' ',
		operator,
		createConditionalBreak(indent([line, rightDoc]), [' ', rightDoc]),
	]);
};

/**
 * Creates a document for comma-separated lists with proper line breaks.
 * @param items - The items to join.
 * @param shouldBreak - Whether to allow line breaks (default: true).
 * @returns A comma-separated list document.
 * @example
 * ```typescript
 * createCommaSeparatedList([item1, item2, item3])
 * ```
 */
export const createCommaSeparatedList = (
	items: Doc[],
	shouldBreak: boolean = true,
): Doc => {
	if (shouldBreak) {
		return createJoinedDoc(items, [',', line]);
	}
	return createJoinedDoc(items, [', ', '']);
};

/**
 * Creates a document for semicolon-terminated statements.
 * @param content - The statement content.
 * @param shouldBreak - Whether to allow line breaks before semicolon (default: false).
 * @returns A semicolon-terminated document.
 * @example
 * ```typescript
 * createStatementDoc(variableDeclaration)
 * ```
 */
export const createStatementDoc = (
	content: Doc,
	shouldBreak: boolean = false,
): Doc => {
	if (shouldBreak) {
		return createGroupedDoc([content, ifBreak('', ';')]);
	}
	return [content, ';'];
};