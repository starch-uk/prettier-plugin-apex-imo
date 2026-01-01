/**
 * @file Functions for formatting Apex List and Map collection literals.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { doc, type AstPath, type Doc } from 'prettier';
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

const { group, indent, hardline, join } = doc.builders;

const printCollection = (
	path: Readonly<AstPath<ApexListInitNode | ApexMapInitNode>>,
	print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	originalPrint: () => Doc,
): Doc => {
	const { node } = path;
	const nodeClass = getNodeClass(node);
	const isList =
		nodeClass === LIST_LITERAL_CLASS || nodeClass === SET_LITERAL_CLASS;
	if (
		(isList && !hasMultipleListEntries(node as ApexListInitNode)) ||
		(!isList && !hasMultipleMapEntries(node as ApexMapInitNode))
	)
		return originalPrint();
	const typeNormalizingPrint = createTypeNormalizingPrint(
		print,
		true,
		'types',
	);
	const printedTypes = path.map(typeNormalizingPrint, 'types' as never);
	if (isList) {
		const isSet = nodeClass === SET_LITERAL_CLASS;
		const typeSeparator: Doc = isSet ? [',', ' '] : '.';
		const typeName = isSet ? 'Set' : 'List';
		return group([
			typeName,
			'<',
			join(typeSeparator, printedTypes),
			'>',
			group([
				'{',
				indent([
					hardline,
					join([',', hardline], path.map(print, 'values' as never)),
				]),
				hardline,
				'}',
			]),
		]);
	}
	return group([
		'Map<',
		join(', ', printedTypes),
		'>',
		group([
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
		]),
	]);
};

export {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
	printCollection,
};
