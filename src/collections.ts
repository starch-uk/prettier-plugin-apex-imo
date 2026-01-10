/**
 * @file Functions for formatting Apex List and Map collection literals.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { doc, type AstPath, type Doc, type ParserOptions } from 'prettier';
import type { ApexNode, ApexListInitNode, ApexMapInitNode } from './types.js';
import { getNodeClass } from './utils.js';
import { createTypeNormalizingPrint } from './casing.js';

const MIN_ENTRIES_FOR_MULTILINE = 2;
const LIST_LITERAL_CLASS = 'apex.jorje.data.ast.NewObject$NewListLiteral';
const SET_LITERAL_CLASS = 'apex.jorje.data.ast.NewObject$NewSetLiteral';
const MAP_LITERAL_CLASS = 'apex.jorje.data.ast.NewObject$NewMapLiteral';
const isListInit = (
	node: Readonly<ApexNode>,
): node is Readonly<ApexListInitNode> => {
	const cls = getNodeClass(node);
	return cls === LIST_LITERAL_CLASS || cls === SET_LITERAL_CLASS;
};

const isMapInit = (
	node: Readonly<ApexNode>,
): node is Readonly<ApexMapInitNode> =>
	getNodeClass(node) === MAP_LITERAL_CLASS;

const hasMultipleListEntries = (node: Readonly<ApexListInitNode>): boolean =>
	Array.isArray(node.values) &&
	node.values.length >= MIN_ENTRIES_FOR_MULTILINE;

const hasMultipleMapEntries = (node: Readonly<ApexMapInitNode>): boolean =>
	Array.isArray(node.pairs) && node.pairs.length >= MIN_ENTRIES_FOR_MULTILINE;

const { group, indent, hardline, join, softline } = doc.builders;

const isNestedInCollection = (
	path: Readonly<AstPath<ApexListInitNode | ApexMapInitNode>>,
): boolean => {
	const { stack } = path;
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Array length check
	if (!Array.isArray(stack) || stack.length === 0) return false;
	// Check if any parent in the stack is a collection using AST type guards
	for (const parent of stack) {
		if (typeof parent === 'object' && parent !== null && '@class' in parent) {
			// Use AST type guards instead of array check
			if (isListInit(parent as ApexNode) || isMapInit(parent as ApexNode)) {
				return true;
			}
		}
	}
	return false;
};

const printCollection = (
	path: Readonly<AstPath<ApexListInitNode | ApexMapInitNode>>,
	print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	originalPrint: () => Doc,
): Doc => {
	const { node } = path;
	const nodeClass = getNodeClass(node);
	const isList =
		nodeClass === LIST_LITERAL_CLASS || nodeClass === SET_LITERAL_CLASS;
	
	const hasMultipleEntries = isList
		? hasMultipleListEntries(node as ApexListInitNode)
		: hasMultipleMapEntries(node as ApexMapInitNode);
	const typeNormalizingPrint = createTypeNormalizingPrint(
		print,
		true,
		'types',
	);
	const printedTypes = path.map(typeNormalizingPrint, 'types' as never);
	const isNested = isNestedInCollection(path);
	
	const EMPTY_COLLECTION_LENGTH = 0;
	// Check if collection is actually empty (no entries at all)
	const listNode = isList ? (node as ApexListInitNode) : undefined;
	const mapNode = !isList ? (node as ApexMapInitNode) : undefined;
	const isEmpty = isList
		? !Array.isArray(listNode?.values) || (listNode?.values.length ?? 0) === EMPTY_COLLECTION_LENGTH
		: !Array.isArray(mapNode?.pairs) || (mapNode?.pairs.length ?? 0) === EMPTY_COLLECTION_LENGTH;
	
	// For empty collections (no entries), we still need to handle them to ensure
	// type parameters can break when they exceed printWidth
	if (isEmpty) {
		// For empty collections, construct the typeDoc with break points to allow
		// Prettier to break long type parameters when they exceed printWidth
		if (isList) {
			const isSet = nodeClass === SET_LITERAL_CLASS;
		// For Set, add break points after commas to allow breaking
		// For List, the dot separator is part of the type name syntax, so we can't break there
		const typeName = isSet ? 'Set' : 'List';
		const typeSeparator: Doc = isSet ? [',', softline] : '.';
		// For non-nested, don't wrap in group to allow parent to break when line exceeds printWidth
		const typeDoc: Doc = isNested
			? group([typeName, '<', join(typeSeparator, printedTypes), '>'])
			: [typeName, '<', join(typeSeparator, printedTypes), '>'];
		return [typeDoc, '{}'];
		}
		// For empty Maps, add break points in type parameters to allow breaking
		// Use group with softline to allow breaking when line exceeds printWidth
		// Add softline before and after type parameters to allow breaking
		const typeDoc: Doc = isNested
			? group(['Map<', join([', ', softline], printedTypes), '>'])
			: group(['Map<', softline, join([', ', softline], printedTypes), softline, '>']);
		return [typeDoc, '{}'];
	}
	
	// For collections with entries but fewer than MIN_ENTRIES_FOR_MULTILINE (single item),
	// delegate to the original printer to handle inline formatting
	if (!hasMultipleEntries) {
		return originalPrint();
	}
	if (isList) {
		const isSet = nodeClass === SET_LITERAL_CLASS;
		// For Set, add break points after commas to allow breaking
		// For List, the dot separator is part of the type name syntax, so we can't break there
		const typeSeparator: Doc = isSet ? [',', softline] : '.';
		const typeName = isSet ? 'Set' : 'List';
		// For nested collections, wrap type in group to keep it together
		// For top-level collections, don't wrap type in group to allow Prettier
		// to break assignments when they exceed pageWidth
		const typeDoc: Doc = isNested
			? group([typeName, '<', join(typeSeparator, printedTypes), '>'])
			: [typeName, '<', join(typeSeparator, printedTypes), '>'];
		// Force multiline by ensuring the literal part is never in a collapsible group
		// Use hardline which should force multiline, but can be collapsed by parent groups
		return [
			typeDoc,
			'{',
			indent([
				hardline,
				join([',', hardline], path.map(print, 'values' as never)),
			]),
			hardline,
			'}',
		];
	}
	// Force multiline by ensuring the literal part is never in a collapsible group
	// Use hardline which should force multiline, but can be collapsed by parent groups
	// For nested collections, wrap type in group to keep it together
	// For top-level collections, don't wrap in group to allow parent to break when line exceeds printWidth
	const typeDoc: Doc = isNested
		? group(['Map<', join([', ', softline], printedTypes), '>'])
		: ['Map<', join([', ', softline], printedTypes), '>'];
	const result = [
		typeDoc,
		'{',
		indent([
			hardline,
			join(
				[',', hardline],
				path.map(
					(pairPath: Readonly<AstPath<ApexNode>>) => [
						pairPath.call(print, 'key' as never),
						' => ',
						pairPath.call(print, 'value' as never),
					],
					'pairs' as never,
				),
			),
		]),
		hardline,
		'}',
	];
	return result;
};

export {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
	printCollection,
};
