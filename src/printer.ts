/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
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
	normalizeStandardObjectType,
} from './utils.js';
import type { ApexIdentifier } from './types.js';
const { group, indent, hardline, softline, join } = doc.builders;

/**
 * Check if a node is an identifier node (including FieldIdentifier for SOQL)
 */
function isIdentifier(
	node: Readonly<ApexNode> | null | undefined,
): node is Readonly<ApexIdentifier> {
	if (!node || typeof node !== 'object') return false;
	const nodeClass = node['@class'];
	return (
		(typeof nodeClass === 'string' &&
			(nodeClass === 'apex.jorje.data.ast.Identifier' ||
				nodeClass.includes('Identifier'))) ||
		('value' in node &&
			typeof (node as { value?: unknown }).value === 'string')
	);
}

/**
 * Check if we're in a type context based on the AST path
 */
function isInTypeContext(path: Readonly<AstPath<ApexNode>>): boolean {
	const { key } = path;

	// Check if we're in the 'types' field of a List/Set/Map node
	if (key === 'types') return true;

	// Check for other common type field names
	// Common fields that contain types in Apex AST:
	// - 'type' or 'typeRef' for variable declarations
	// - 'returnType' for method return types
	// - 'types' for generic type parameters
	// - 'table' for SOQL FROM clause object names
	// - 'field' when parent is a FieldIdentifier in a 'table' context (SOQL FROM)
	if (typeof key === 'string') {
		const lowerKey = key.toLowerCase();
		if (
			lowerKey === 'type' ||
			lowerKey === 'typeref' ||
			lowerKey === 'returntype' ||
			lowerKey === 'table' ||
			lowerKey.startsWith('type')
		) {
			return true;
		}
		// Check if we're printing the 'field' property of a FieldIdentifier that's in a 'table' context (SOQL FROM)
		if (lowerKey === 'field') {
			const { stack } = path;
			if (Array.isArray(stack)) {
				// Look for FromExpr in the stack - if present, this field is in a SOQL FROM clause
				for (const ancestor of stack) {
					if (typeof ancestor === 'object' && '@class' in ancestor) {
						const ancestorClass = ancestor['@class'];
						if (
							typeof ancestorClass === 'string' &&
							ancestorClass.includes('FromExpr')
						) {
							return true;
						}
					}
				}
			}
		}
	}

	// Check if we're in a type position by examining parent nodes
	// This is a heuristic - we check for common type contexts
	const { stack } = path;
	if (Array.isArray(stack) && stack.length >= 2) {
		const parent = stack[stack.length - 2] as Readonly<ApexNode>;
		const parentClass = parent['@class'];

		// Check for type reference nodes (common AST node types for types)
		// This is a best-effort approach based on common Apex AST patterns
		if (
			typeof parentClass === 'string' &&
			(parentClass.includes('TypeRef') ||
				(parentClass.includes('Type') &&
					!parentClass.includes('Variable')) ||
				// Check for SOQL FromExpr - object names in FROM clauses should be normalized
				parentClass.includes('FromExpr') ||
				// Check if parent has a 'types' field and we might be in it
				('types' in parent && Array.isArray(parent.types)))
		) {
			// Make sure we're not in a variable declaration (variable names shouldn't be normalized)
			// Check if we're in a 'name' field that's for a variable, not a type
			if (
				key === 'name' &&
				typeof parentClass === 'string' &&
				parentClass.includes('Variable')
			) {
				return false;
			}
			return true;
		}
	}

	return false;
}

/**
 * Check if a node is a TypeRef node
 */
function isTypeRef(node: Readonly<ApexNode> | null | undefined): boolean {
	if (!node || typeof node !== 'object') return false;
	const nodeClass = node['@class'];
	return (
		typeof nodeClass === 'string' &&
		(nodeClass.includes('TypeRef') ||
			nodeClass === 'apex.jorje.data.ast.TypeRef')
	);
}

/**
 * Create a wrapped print function that normalizes type identifiers
 * @param originalPrint - The original print function
 * @param forceTypeContext - If true, always treat as type context
 * @param parentKey - The key of the parent field (for debugging type context)
 */
function createTypeNormalizingPrint(
	originalPrint: (path: Readonly<AstPath<ApexNode>>) => Doc,
	forceTypeContext = false,
	parentKey?: string,
): (path: Readonly<AstPath<ApexNode>>) => Doc {
	return (subPath: Readonly<AstPath<ApexNode>>): Doc => {
		const { node } = subPath;
		// If parentKey is provided, use it to determine type context
		// Otherwise use the path key
		const { key } = subPath;
		const isTypeCtx =
			forceTypeContext ||
			parentKey === 'types' ||
			key === 'names' ||
			isInTypeContext(subPath);

		// Normalize identifiers in 'names' field (TypeRef names array) or when explicitly in type context
		if (isTypeCtx && isIdentifier(node)) {
			// Handle nodes with a 'value' property (regular Identifier)
			if (
				'value' in node &&
				typeof node.value === 'string' &&
				node.value
			) {
				const nodeValue = node.value;
				const normalizedValue = normalizeStandardObjectType(nodeValue);
				if (normalizedValue !== nodeValue) {
					// Temporarily mutate the node to normalize it, then restore after printing
					try {
						// Mutate the node value
						(node as { value: string }).value = normalizedValue;
						return originalPrint(subPath);
					} finally {
						// Restore original value
						(node as { value: string }).value = nodeValue;
					}
				}
			}
			// Handle FieldIdentifier nodes which may have a 'names' array like TypeRef
			else if (
				'names' in node &&
				Array.isArray((node as { names?: unknown }).names)
			) {
				const namesArray = (
					node as unknown as { names: readonly ApexIdentifier[] }
				).names;
				let hasChanges = false;
				const originalValues: string[] = [];
				try {
					// Mutate identifiers in the names array
					for (let i = 0; i < namesArray.length; i++) {
						const nameNode = namesArray[i];
						if (
							typeof nameNode === 'object' &&
							'value' in nameNode
						) {
							const nameValue = (nameNode as { value?: unknown })
								.value;
							if (typeof nameValue === 'string' && nameValue) {
								originalValues[i] = nameValue;
								const normalizedValue =
									normalizeStandardObjectType(nameValue);
								if (normalizedValue !== nameValue) {
									hasChanges = true;
									(nameNode as { value: string }).value =
										normalizedValue;
								}
							}
						}
					}
					if (hasChanges) {
						return originalPrint(subPath);
					}
				} finally {
					// Restore original values
					for (
						let i = 0;
						i < originalValues.length && i < namesArray.length;
						i++
					) {
						const originalValue = originalValues[i];
						// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
						if (originalValue !== undefined) {
							const nameNode = namesArray[i];
							if (
								typeof nameNode === 'object' &&
								'value' in nameNode
							) {
								(nameNode as { value: string }).value =
									originalValue;
							}
						}
					}
				}
			}
		}

		return originalPrint(subPath);
	};
}

function printListInit(
	path: Readonly<AstPath<ApexListInitNode>>,
	print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	originalPrint: () => Doc,
): Doc {
	const { node } = path;
	if (!hasMultipleListEntries(node)) return originalPrint();
	const isSet =
		node['@class'] === 'apex.jorje.data.ast.NewObject$NewSetLiteral';
	// Normalize type identifiers when printing types - force type context for types array
	// Pass 'types' as parentKey so sub-paths know they're in a type context
	const typeNormalizingPrint = createTypeNormalizingPrint(
		print,
		true,
		'types',
	);
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	const printedTypes = path.map(
		typeNormalizingPrint,
		'types' as never,
	) as Doc[];
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	const printedValues = path.map(print, 'values' as never) as Doc[];
	return group([
		isSet ? 'Set' : 'List',
		'<',
		isSet ? join([',', ' '], printedTypes) : join('.', printedTypes),
		'>',
		group([
			'{',
			indent([hardline, join([',', hardline], printedValues)]),
			hardline,
			'}',
		]),
	]);
}

function printMapInit(
	path: Readonly<AstPath<ApexMapInitNode>>,
	print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	originalPrint: () => Doc,
): Doc {
	const { node } = path;
	if (!hasMultipleMapEntries(node)) return originalPrint();
	// Normalize type identifiers when printing types - force type context for types array
	// Pass 'types' as parentKey so sub-paths know they're in a type context
	const typeNormalizingPrint = createTypeNormalizingPrint(
		print,
		true,
		'types',
	);
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	const printedTypes = path.map(
		typeNormalizingPrint,
		'types' as never,
	) as Doc[];
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	const printedPairs = path.map(
		(pairPath: Readonly<AstPath<ApexNode>>) => [
			pairPath.call(print, 'key' as never),
			' => ',
			pairPath.call(print, 'value' as never),
		],
		'pairs' as never,
	) as Doc[][];
	return group([
		'Map<',
		join(', ', printedTypes),
		'>',
		group([
			'{',
			indent([hardline, join([',', hardline], printedPairs)]),
			hardline,
			'}',
		]),
	]);
}

function printAnnotation(path: Readonly<AstPath<ApexAnnotationNode>>): Doc {
	const { node } = path;
	const originalName = node.name.value;
	const normalizedName = normalizeAnnotationName(originalName);
	if (node.parameters.length === 0) return ['@', normalizedName, hardline];
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
	return [
		group([
			'@',
			normalizedName,
			forceMultiline
				? group([
						'(',
						indent([
							hardline,
							join([' ', hardline], formattedParams),
						]),
						hardline,
						')',
					])
				: group([
						'(',
						indent([
							softline,
							join([' ', softline], formattedParams),
						]),
						softline,
						')',
					]),
		]),
		hardline,
	];
}

export function createWrappedPrinter(
	originalPrinter: Readonly<{
		readonly [key: string]: unknown;
		readonly print: (
			path: Readonly<AstPath<ApexNode>>,
			options: Readonly<ParserOptions>,
			print: (path: Readonly<AstPath<ApexNode>>) => Doc,
		) => Doc;
	}>,
): {
	readonly [key: string]: unknown;
	readonly print: (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	) => Doc;
} {
	const customPrint = function (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc {
		const { node } = path;
		// Create a type-normalizing print function for all nodes
		const typeNormalizingPrint = createTypeNormalizingPrint(print);

		if (isAnnotation(node))
			return printAnnotation(
				path as Readonly<AstPath<ApexAnnotationNode>>,
			);
		if (isListInit(node))
			return printListInit(
				path as Readonly<AstPath<ApexListInitNode>>,
				typeNormalizingPrint,
				() =>
					originalPrinter.print(path, options, typeNormalizingPrint),
			);
		if (isMapInit(node))
			return printMapInit(
				path as Readonly<AstPath<ApexMapInitNode>>,
				typeNormalizingPrint,
				() =>
					originalPrinter.print(path, options, typeNormalizingPrint),
			);

		// Handle TypeRef nodes - normalize names array when printing
		if (isTypeRef(node) && 'names' in node) {
			const namesField = (node as { names?: unknown }).names;
			if (Array.isArray(namesField) && namesField.length > 0) {
				// Use a normalizing print function for names
				const namesNormalizingPrint = createTypeNormalizingPrint(
					print,
					true,
					'names',
				);
				// Print the TypeRef but use normalizing print for names
				// We'll let the original printer handle the structure, but intercept names printing
				const originalPrintForTypeRef = (
					subPath: Readonly<AstPath<ApexNode>>,
				): Doc => {
					const subKey = subPath.key;
					if (subKey === 'names') {
						// When printing names array, use our normalizing print
						return namesNormalizingPrint(subPath);
					}
					return print(subPath);
				};
				return originalPrinter.print(
					path,
					options,
					originalPrintForTypeRef,
				);
			}
		}

		// For other nodes, use type-normalizing print if it's an identifier in type context
		if (isIdentifier(node) && isInTypeContext(path)) {
			const normalizedValue = normalizeStandardObjectType(node.value);
			if (normalizedValue !== node.value) {
				const normalizedNode: ApexIdentifier = {
					...node,
					value: normalizedValue,
				};
				const normalizedPath = {
					...path,
					node: normalizedNode,
				} as Readonly<AstPath<ApexNode>>;
				return originalPrinter.print(
					normalizedPath,
					options,
					typeNormalizingPrint,
				);
			}
		}

		return originalPrinter.print(path, options, typeNormalizingPrint);
	};
	return { ...originalPrinter, print: customPrint };
}
