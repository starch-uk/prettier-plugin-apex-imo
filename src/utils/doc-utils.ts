/**
 * @file Utility functions for common Prettier doc builder patterns.
 */

import type { Doc } from 'prettier';
import * as prettier from 'prettier';

const { group, indent, ifBreak, line, softline } = prettier.doc.builders;

/**
 * Creates a group with the given contents.
 * @param contents - The doc contents to group.
 * @returns A grouped doc.
 * @example
 * ```typescript
 * const doc = createGroup(['function', ' ', name, '()']);
 * ```
 */
const createGroup = (contents: Doc): Doc => group(contents);

/**
 * Creates a group with indentation for the given contents.
 * @param contents - The doc contents to group and indent.
 * @returns A grouped and indented doc.
 * @example
 * ```typescript
 * const doc = createIndentGroup(['param1,', line, 'param2']);
 * ```
 */
const createIndentGroup = (contents: Doc): Doc => group(indent(contents));

/**
 * Creates a conditional break group that behaves differently based on whether a break occurs.
 * @param flatContents - The contents when no break occurs.
 * @param breakContents - The contents when a break occurs.
 * @returns A conditional break doc.
 * @example
 * ```typescript
 * const doc = createIfBreakGroup(['name = value'], indent([line, 'name =', line, 'value']));
 * ```
 */
const createIfBreakGroup = (flatContents: Doc, breakContents: Doc): Doc =>
	ifBreak(breakContents, flatContents);

/**
 * Creates a soft line break that becomes a space in flat mode or a newline when broken.
 * @returns A soft line doc.
 * @example
 * ```typescript
 * const doc = group(['item1,', softLineBreak(), 'item2']);
 * ```
 */
const softLineBreak = (): Doc => softline;

/**
 * Creates a line break that becomes a space in flat mode or a newline when broken.
 * @returns A line doc.
 * @example
 * ```typescript
 * const doc = group(['item1,', lineBreak(), 'item2']);
 * ```
 */
const lineBreak = (): Doc => line;

/**
 * Creates an indented doc with the given contents.
 * @param contents - The contents to indent.
 * @returns An indented doc.
 * @example
 * ```typescript
 * const doc = createIndent(['line1', line, 'line2']);
 * ```
 */
const createIndent = (contents: Doc): Doc => indent(contents);

export {
	createGroup,
	createIndent,
	createIndentGroup,
	createIfBreakGroup,
	lineBreak,
	softLineBreak,
};