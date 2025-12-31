/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { doc, type AstPath, type Doc, type ParserOptions } from 'prettier';
import type {
	ApexNode,
	ApexListInitNode,
	ApexMapInitNode,
	ApexAnnotationNode,
	ApexAnnotationKeyValue,
} from './types.js';
import {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
	isAnnotation,
	normalizeAnnotationName,
	normalizeAnnotationOptionName,
	formatAnnotationValue,
} from './utils.js';
const { group, indent, hardline, softline, join } = doc.builders;

/**
 * Options for printing List/Set literals
 */
interface PrintListInitOptions {
	readonly path: Readonly<AstPath<ApexListInitNode>>;
	readonly options: Readonly<ParserOptions>;
	readonly print: (path: Readonly<AstPath<ApexNode>>) => Doc;
	readonly originalPrint: () => Doc;
}

/**
 * Print a List or Set literal with forced multiline when 2+ entries
 */
function printListInit({
	path,
	options: _options,
	print,
	originalPrint,
}: PrintListInitOptions): Doc {
	const { node } = path;

	// Only force multiline for 2+ entries
	if (!hasMultipleListEntries(node)) {
		return originalPrint();
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unnecessary-type-assertion
	const printedTypes = path.map(print, 'types' as never) as Doc[];
	const isSet =
		node['@class'] === 'apex.jorje.data.ast.NewObject$NewSetLiteral';
	const typesDoc = isSet
		? join([',', ' '], printedTypes)
		: join('.', printedTypes);

	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unnecessary-type-assertion
	const printedValues = path.map(print, 'values' as never) as Doc[];
	const multilineLiteral = group([
		'{',
		indent([hardline, join([',', hardline], printedValues)]),
		hardline,
		'}',
	]);

	return group([
		isSet ? 'Set' : 'List',
		'<',
		typesDoc,
		'>',
		multilineLiteral,
	]);
}

/**
 * Options for printing Map literals
 */
interface PrintMapInitOptions {
	readonly path: Readonly<AstPath<ApexMapInitNode>>;
	readonly options: Readonly<ParserOptions>;
	readonly print: (path: Readonly<AstPath<ApexNode>>) => Doc;
	readonly originalPrint: () => Doc;
}

/**
 * Print a Map literal with forced multiline when 2+ entries
 */
function printMapInit({
	path,
	options: _options,
	print,
	originalPrint,
}: PrintMapInitOptions): Doc {
	const { node } = path;

	// Only force multiline for 2+ entries
	if (!hasMultipleMapEntries(node)) {
		return originalPrint();
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unnecessary-type-assertion
	const printedTypes = path.map(print, 'types' as never) as Doc[];
	const typesDoc = join(', ', printedTypes);

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	const printedPairs = path.map(
		(pairPath: Readonly<AstPath<ApexNode>>) => [
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
			pairPath.call(print, 'key' as never),
			' => ',
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
			pairPath.call(print, 'value' as never),
		],
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		'pairs' as never,
	) as Doc[][];

	const multilineLiteral = group([
		'{',
		indent([hardline, join([',', hardline], printedPairs)]),
		hardline,
		'}',
	]);

	return group(['Map<', typesDoc, '>', multilineLiteral]);
}

/**
 * Options for printing annotations
 */
/**
 * Print an annotation with normalized names and formatted parameters
 */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
function printAnnotation({
	path,
}: {
	readonly path: Readonly<AstPath<ApexAnnotationNode>>;
}): Doc {
	const { node } = path;

	const originalName = node.name.value;
	const normalizedName = normalizeAnnotationName(originalName);
	if (node.parameters.length === 0) {
		return ['@', normalizedName];
	}

	const formattedParams: Doc[] = node.parameters.map((param) => {
		if (
			param['@class'] ===
			'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue'
		) {
			const kvParam = param as ApexAnnotationKeyValue;
			return [
				normalizeAnnotationOptionName(originalName, kvParam.key.value),
				'=',
				formatAnnotationValue(kvParam.value),
			];
		}
		return `'${(param as unknown as { value: string }).value}'`;
	});

	const isSmartWrap = ['invocablemethod', 'invocablevariable'].includes(
		normalizedName.toLowerCase(),
	);
	const forceMultiline =
		isSmartWrap &&
		(formattedParams.length > 1 ||
			formattedParams.some(
				(p) => typeof p === 'string' && p.length > 40,
			));

	if (forceMultiline) {
		return [
			group([
				'@',
				normalizedName,
				'(',
				indent([hardline, join([' ', hardline], formattedParams)]),
				hardline,
				')',
			]),
			hardline,
		];
	}

	return [
		group([
			'@',
			normalizedName,
			group([
				'(',
				indent([softline, join([' ', softline], formattedParams)]),
				softline,
				')',
			]),
		]),
		hardline,
	];
}

/**
 * Create a wrapped printer that intercepts List/Map literals
 */
export function createWrappedPrinter(
	originalPrinter: Readonly<{
		readonly print: (
			path: Readonly<AstPath<ApexNode>>,
			options: Readonly<ParserOptions>,
			print: (path: Readonly<AstPath<ApexNode>>) => Doc,
		) => Doc;
		// eslint-disable-next-line @typescript-eslint/member-ordering
		readonly [key: string]: unknown;
	}>,
): {
	readonly print: (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	) => Doc;
	// eslint-disable-next-line @typescript-eslint/member-ordering
	readonly [key: string]: unknown;
} {
	const customPrint = (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc => {
		const { node } = path;

		// Intercept annotations
		if (isAnnotation(node)) {
			return printAnnotation({
				path: path as Readonly<AstPath<ApexAnnotationNode>>,
			});
		}

		// Intercept List/Set literals directly
		// The NewObject$NewListLiteral/NewSetLiteral node contains types and values
		// We intercept here and construct the full expression (types + multiline literal)
		if (isListInit(node)) {
			// Type guard ensures node is ApexListInitNode
			const listPath = path as Readonly<AstPath<ApexListInitNode>>;
			return printListInit({
				path: listPath,
				options,
				print,
				originalPrint: () =>
					originalPrinter.print(path, options, print),
			});
		}

		// Intercept Map literals
		if (isMapInit(node)) {
			// Type guard ensures node is ApexMapInitNode
			const mapPath = path as Readonly<AstPath<ApexMapInitNode>>;
			return printMapInit({
				path: mapPath,
				options,
				print,
				originalPrint: () =>
					originalPrinter.print(path, options, print),
			});
		}

		// All other nodes: use original printer
		return originalPrinter.print(path, options, print);
	};

	// Create new object by spreading original printer properties, then override with custom print
	// This ensures our custom print method overrides the original one
	const result = {
		...originalPrinter,
		print: customPrint,
	};
	return result;
}
