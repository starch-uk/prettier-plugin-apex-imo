/**
 * @file Functions for formatting Apex List and Map collection literals.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { doc, type AstPath, type Doc } from 'prettier';
import type { ApexNode, ApexListInitNode, ApexMapInitNode } from './types.js';
import { getNodeClass, isEmpty } from './utils.js';
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
	if (!Array.isArray(stack) || stack.length === 0) return false;
	for (const parent of stack) {
		if (
			typeof parent === 'object' &&
			parent !== null &&
			'@class' in parent &&
			(isListInit(parent as ApexNode) || isMapInit(parent as ApexNode))
		) {
			return true;
		}
	}
	return false;
};

/**
 * Creates type document for collections.
 */
const createTypeDoc = (
	typeName: string,
	printedTypes: readonly Doc[],
	typeSeparator: Doc,
	isNested: boolean,
): Doc => {
	const baseTypeDoc: Doc = [
		typeName,
		'<',
		join(typeSeparator, printedTypes),
		'>',
	];
	return isNested ? group(baseTypeDoc) : baseTypeDoc;
};

const printEmptyList = (
	printedTypes: readonly Doc[],
	isSet: boolean,
	isNested: boolean,
): Doc => [
	createTypeDoc(
		isSet ? 'Set' : 'List',
		printedTypes,
		isSet ? [',', softline] : '.',
		isNested,
	),
	'{}',
];

const printEmptyMap = (printedTypes: readonly Doc[]): Doc => {
	const typeDoc: Doc = group([
		'Map<',
		join([', ', softline], printedTypes),
		'>',
	]);
	return [typeDoc, '{}'];
};

const printList = ({
	path,
	print,
	originalPrint,
	printedTypes,
	isNested,
	nodeClass,
}: {
	readonly path: Readonly<AstPath<ApexListInitNode>>;
	readonly print: (path: Readonly<AstPath<ApexNode>>) => Doc;
	readonly originalPrint: () => Doc;
	readonly printedTypes: readonly Doc[];
	readonly isNested: boolean;
	readonly nodeClass: string;
}): Doc => {
	const { node } = path;
	const isSet = nodeClass === SET_LITERAL_CLASS;
	const isEmptyValues = !Array.isArray(node.values) || isEmpty(node.values);

	if (isEmptyValues) {
		return printEmptyList(printedTypes, isSet, isNested);
	}

	if (!hasMultipleListEntries(node)) {
		return originalPrint();
	}

	const typeDoc = createTypeDoc(
		isSet ? 'Set' : 'List',
		printedTypes,
		isSet ? [',', softline] : '.',
		isNested,
	);
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
};

const printMap = ({
	path,
	print,
	originalPrint,
	printedTypes,
}: {
	readonly path: Readonly<AstPath<ApexMapInitNode>>;
	readonly print: (path: Readonly<AstPath<ApexNode>>) => Doc;
	readonly originalPrint: () => Doc;
	readonly printedTypes: readonly Doc[];
}): Doc => {
	const node = path.node;
	const isEmptyPairs = !Array.isArray(node.pairs) || isEmpty(node.pairs);

	if (isEmptyPairs) {
		return printEmptyMap(printedTypes);
	}

	if (!hasMultipleMapEntries(node)) {
		return originalPrint();
	}

	const typeDoc: Doc = group([
		'Map<',
		join([', ', softline], printedTypes),
		'>',
	]);
	return [
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

	const typeNormalizingPrint = createTypeNormalizingPrint(
		print,
		true,
		'types',
	);
	const printedTypes = path.map(typeNormalizingPrint, 'types' as never);
	const isNested = isNestedInCollection(path);

	if (isList) {
		return printList({
			path: path as Readonly<AstPath<ApexListInitNode>>,
			print,
			originalPrint,
			printedTypes,
			isNested,
			nodeClass,
		});
	}
	return printMap({
		path: path as Readonly<AstPath<ApexMapInitNode>>,
		print,
		originalPrint,
		printedTypes,
	});
};

export {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
	printCollection,
};
