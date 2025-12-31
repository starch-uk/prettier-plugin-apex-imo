/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
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

// Constants for annotation formatting
const ANNOTATION_MAGIC_NUMBERS = {
	zero: 0,
	one: 1,
	forty: 40,
} as const;

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
 * Options for printing annotations
 */
interface PrintAnnotationOptions {
	readonly path: Readonly<AstPath<ApexAnnotationNode>>;
	readonly options: Readonly<ParserOptions>;
	readonly print: (path: Readonly<AstPath<ApexNode>>) => Doc;
	readonly originalPrint: () => Doc;
}

/**
 * Print an annotation with normalized names and formatted parameters
 */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
function printAnnotation({
	path,
	options: _options,
	print: _print,
	originalPrint: _originalPrint,
}: PrintAnnotationOptions): Doc {
	const { node } = path;

	// Normalize annotation name
	const nameNode = node.name;
	const originalName = nameNode.value;
	const normalizedName = normalizeAnnotationName(originalName);

	// If no parameters, just return normalized name
	if (node.parameters.length === ANNOTATION_MAGIC_NUMBERS.zero) {
		return ['@', normalizedName];
	}

	// Format parameters
	const formattedParams: Doc[] = [];
	for (const param of node.parameters) {
		const paramClass = param['@class'];

		if (
			paramClass ===
			'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue'
		) {
			const kvParam = param as ApexAnnotationKeyValue;
			const keyName = kvParam.key.value;
			const normalizedKey = normalizeAnnotationOptionName(
				originalName,
				keyName,
			);
			const valueStr = formatAnnotationValue(kvParam.value);
			formattedParams.push([normalizedKey, '=', valueStr]);
		} else {
			// AnnotationString parameter
			const strParam = param as unknown as { value: string };
			// For SuppressWarnings, format as comma-separated string
			formattedParams.push(`'${strParam.value}'`);
		}
	}

	// Wrapping rules:
	// - InvocableMethod and InvocableVariable: smart wrapping (force multiline if multiple params or long strings)
	// - All other annotations: printWidth-based wrapping (Prettier's default group() behavior)
	const lowerAnnotationName = normalizedName.toLowerCase();
	const useSmartWrapping = ['invocablemethod', 'invocablevariable'].includes(
		lowerAnnotationName,
	);

	// For smart wrapping annotations: force multiline if multiple params or long strings
	if (useSmartWrapping) {
		const shouldForceMultiline =
			formattedParams.length > ANNOTATION_MAGIC_NUMBERS.one ||
			formattedParams.some(
				(p) =>
					typeof p === 'string' &&
					p.length > ANNOTATION_MAGIC_NUMBERS.forty,
			);

		if (shouldForceMultiline) {
			// Force multiline format - space separated
			// Add newline after ')' since annotations are modifiers and need newlines after them
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
	}

	// Single line format (will wrap based on printWidth if needed)
	// For smart wrapping annotations, this is used when single line fits
	// For other annotations, we still need to normalize names/options, but we can use
	// the original printer's formatting structure. However, since normalization happens
	// in preprocess, the AST already has normalized names. But in unit tests, we need
	// to handle normalization here. So we'll use our custom formatting for all annotations
	// to ensure normalization works in both cases.
	// Modifiers are space-separated, not comma-separated
	// Use group() to allow Prettier to wrap based on printWidth
	// Structure allows breaking after '(' when content is too long
	// Add hardline after ')' since annotations are modifiers and need newlines after them
	const annotationDoc = group([
		'@',
		normalizedName,
		group([
			'(',
			indent([softline, join([' ', softline], formattedParams)]),
			softline,
			')',
		]),
	]);
	return [annotationDoc, hardline];
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
			const annotationPath = path as Readonly<
				AstPath<ApexAnnotationNode>
			>;
			return printAnnotation({
				path: annotationPath,
				options,
				print,
				originalPrint: () =>
					originalPrinter.print(path, options, print),
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
