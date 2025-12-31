/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { doc, type AstPath, type Doc, type ParserOptions } from 'prettier';
import type { ApexNode, ApexListInitNode, ApexMapInitNode } from './types.js';
import {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
} from './utils.js';
const { group, indent, hardline, join } = doc.builders;

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

	// The NewObject$NewListLiteral or NewObject$NewSetLiteral node contains both types and values
	// We need to print: List<types> or Set<types> + multiline literal
	// Print the types using path.map(print, 'types') - this is how the original printer does it
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	const printedTypesRaw = path.map(print, 'types' as never);
	const printedTypes: Doc[] = Array.isArray(printedTypesRaw)
		? printedTypesRaw
		: [];
	const nodeClass = node['@class'];
	const isSet = nodeClass === 'apex.jorje.data.ast.NewObject$NewSetLiteral';

	// List types are joined with '.', Set types are joined with ', '
	const typesDoc = isSet
		? join([',', ' '], printedTypes)
		: join('.', printedTypes);

	// Print multiline literal
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	const printedValuesRaw = path.map(print, 'values' as never);
	const printedValues: Doc[] = Array.isArray(printedValuesRaw)
		? printedValuesRaw
		: [];
	const multilineLiteral = group([
		'{',
		indent([hardline, join([',', hardline], printedValues)]),
		hardline,
		'}',
	]);

	// Construct the full expression: List<types> or Set<types> + multiline literal
	const typeName = isSet ? 'Set' : 'List';
	return group([typeName + '<', typesDoc, '>', multilineLiteral]);
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

	// The NewObject$NewMapLiteral node contains both types and pairs
	// We need to print: Map<types> + multiline literal
	// Print the types using path.map(print, 'types')
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	const printedTypesRaw = path.map(print, 'types' as never);
	const printedTypes: Doc[] = Array.isArray(printedTypesRaw)
		? printedTypesRaw
		: [];
	const typesDoc = join(', ', printedTypes); // Map types are joined with ', '

	// Force multiline: each key-value pair on its own line
	const printedPairsRaw = path.map(
		(pairPath: Readonly<AstPath<ApexNode>>) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
			const keyDoc = pairPath.call(print, 'key' as never);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
			const valueDoc = pairPath.call(print, 'value' as never);
			return [keyDoc, ' => ', valueDoc];
		},
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		'pairs' as never,
	);
	const printedPairs: Doc[][] = Array.isArray(printedPairsRaw)
		? printedPairsRaw
		: [];

	const multilineLiteral = group([
		'{',
		indent([hardline, join([',', hardline], printedPairs)]),
		hardline,
		'}',
	]);

	// Construct the full expression: Map<types> + multiline literal
	return group(['Map<', typesDoc, '>', multilineLiteral]);
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

		// Intercept List/Set literals directly
		// The NewObject$NewListLiteral/NewSetLiteral node contains types and values
		// We intercept here and construct the full expression (types + multiline literal)
		if (isListInit(node)) {
			// Type guard ensures node is ApexListInitNode
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
