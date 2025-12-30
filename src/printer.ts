import { doc, type AstPath, type Doc, type ParserOptions } from 'prettier';
import type {
	ApexNode,
	ApexListInitNode,
	ApexMapInitNode,
	PrintFn,
} from './types.js';
import {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
} from './utils.js';
const { group, indent, hardline, join } = doc.builders;

/**
 * Print a List or Set literal with forced multiline when 2+ entries
 */
function printListInit(
	path: AstPath<ApexListInitNode>,
	_options: ParserOptions,
	print: PrintFn,
	originalPrint: () => Doc,
): Doc {
	const node = path.node;

	// Only force multiline for 2+ entries
	if (!hasMultipleListEntries(node)) {
		return originalPrint();
	}

	// The NewObject$NewListLiteral or NewObject$NewSetLiteral node contains both types and values
	// We need to print: List<types> or Set<types> + multiline literal
	// Print the types using path.map(print, 'types') - this is how the original printer does it
	const printedTypes = path.map(print, 'types' as never) as unknown as Doc[];
	const nodeClass = node['@class'];
	const isSet = nodeClass === 'apex.jorje.data.ast.NewObject$NewSetLiteral';

	// List types are joined with '.', Set types are joined with ', '
	const typesDoc = isSet
		? join([',', ' '], printedTypes)
		: join('.', printedTypes);

	// Print multiline literal
	const printedValues = path.map(
		print,
		'values' as never,
	) as unknown as Doc[];
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
 * Print a Map literal with forced multiline when 2+ entries
 */
function printMapInit(
	path: AstPath<ApexMapInitNode>,
	_options: ParserOptions,
	print: PrintFn,
	originalPrint: () => Doc,
): Doc {
	const node = path.node;

	// Only force multiline for 2+ entries
	if (!hasMultipleMapEntries(node)) {
		return originalPrint();
	}

	// The NewObject$NewMapLiteral node contains both types and pairs
	// We need to print: Map<types> + multiline literal
	// Print the types using path.map(print, 'types')
	const printedTypes = path.map(print, 'types' as never) as unknown as Doc[];
	const typesDoc = join(', ', printedTypes); // Map types are joined with ', '

	// Force multiline: each key-value pair on its own line
	const printedPairs = path.map((pairPath) => {
		return [
			pairPath.call(print, 'key' as never) as unknown as Doc,
			' => ',
			pairPath.call(print, 'value' as never) as unknown as Doc,
		];
	}, 'pairs' as never) as unknown as Doc[][];

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
export function createWrappedPrinter(originalPrinter: {
	print: (
		path: AstPath<ApexNode>,
		options: ParserOptions,
		print: PrintFn,
	) => Doc;
	[key: string]: unknown;
}) {
	return {
		...originalPrinter,
		print(
			path: AstPath<ApexNode>,
			options: ParserOptions,
			print: PrintFn,
		): Doc {
			const node = path.node;

			// Intercept List/Set literals directly
			// The NewObject$NewListLiteral/NewSetLiteral node contains types and values
			// We intercept here and construct the full expression (types + multiline literal)
			if (isListInit(node)) {
				return printListInit(
					path as AstPath<ApexListInitNode>,
					options,
					print,
					() => originalPrinter.print(path, options, print),
				);
			}

			// Intercept Map literals
			if (isMapInit(node)) {
				return printMapInit(
					path as AstPath<ApexMapInitNode>,
					options,
					print,
					() => originalPrinter.print(path, options, print),
				);
			}

			// All other nodes: use original printer
			return originalPrinter.print(path, options, print);
		},
	};
}
