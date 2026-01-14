/**
 * @file Functions for normalizing Apex type names, including standard object types and primitive types.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { ApexNode, ApexIdentifier } from './types.js';
import { STANDARD_OBJECTS } from './refs/standard-objects.js';
import { APEX_OBJECT_SUFFIXES } from './refs/object-suffixes.js';
import { getNodeClassOptional } from './utils.js';

/**
 * Normalizes the casing of object type suffixes in a type name.
 * @param typeName - The type name to normalize.
 * @returns The type name with normalized suffix casing.
 * @example
 * ```typescript
 * normalizeObjectSuffix('MyCustomObject__C'); // Returns 'MyCustomObject__c'
 * normalizeObjectSuffix('Knowledge__datacategoryselection'); // Returns 'Knowledge__DataCategorySelection'
 * ```
 */
const SLICE_START_INDEX = 0;

const normalizeStandardObjectType = (typeName: string): string =>
	typeName
		? (STANDARD_OBJECTS[typeName.toLowerCase()] ?? typeName)
		: typeName;

/**
 * Normalizes a type name by first checking if it's a standard object, then normalizing any object suffix.
 * If the type has a suffix, the prefix is normalized as a standard object (if applicable), then the suffix is normalized.
 * @param typeName - The type name to normalize.
 * @returns The normalized type name.
 * @example
 * ```typescript
 * normalizeTypeName('account'); // Returns 'Account'
 * normalizeTypeName('MyCustomObject__C'); // Returns 'MyCustomObject__c'
 * normalizeTypeName('account__c'); // Returns 'Account__c'
 * ```
 */
const normalizeTypeName = (typeName: string): string => {
	if (!typeName || typeof typeName !== 'string') return typeName;
	// Check if it's a pure standard object (no suffix)
	const standardNormalized = normalizeStandardObjectType(typeName);
	// If it was normalized as a standard object, it doesn't have a suffix, so return it
	if (standardNormalized !== typeName) return standardNormalized;
	// Otherwise, check if it has a suffix
	// Find the suffix and normalize prefix + suffix separately
	const suffixes = Object.entries(APEX_OBJECT_SUFFIXES).sort(
		([, a], [, b]) => b.length - a.length,
	);
	const lowerTypeName = typeName.toLowerCase();
	for (const [, normalizedSuffix] of suffixes) {
		const lowerSuffix = normalizedSuffix.toLowerCase();
		if (lowerTypeName.endsWith(lowerSuffix)) {
			const prefix = typeName.slice(
				SLICE_START_INDEX,
				typeName.length - lowerSuffix.length,
			);
			// Normalize the prefix as a standard object (if applicable)
			const normalizedPrefix = normalizeStandardObjectType(prefix);
			// Combine normalized prefix with normalized suffix
			return normalizedPrefix + normalizedSuffix;
		}
	}
	// No suffix found, return as-is (already checked if it's a standard object)
	return typeName;
};

const IDENTIFIER_CLASS = 'apex.jorje.data.ast.Identifier';

const isIdentifier = (
	node: Readonly<ApexNode> | null | undefined,
): node is Readonly<ApexIdentifier> => {
	if (!node || typeof node !== 'object') return false;
	const nodeClass = getNodeClassOptional(node);
	return (
		nodeClass === IDENTIFIER_CLASS ||
		(nodeClass?.includes('Identifier') ?? false) ||
		('value' in node &&
			typeof (node as Record<string, unknown>).value === 'string')
	);
};

const TYPE_CONTEXT_KEYS = ['type', 'typeref', 'returntype', 'table'] as const;
const TYPE_CONTEXT_KEYS_SET = new Set(TYPE_CONTEXT_KEYS);
const STACK_PARENT_OFFSET = 2;

const FROM_EXPR_CLASS = 'apex.jorje.data.ast.FromExpr';
const TYPEREF_CLASS = 'apex.jorje.data.ast.TypeRef';

const hasFromExprInStack = (stack: readonly unknown[]): boolean => {
	for (const item of stack) {
		if (typeof item === 'object' && item !== null && '@class' in item) {
			const nodeClass = getNodeClassOptional(
				item as Record<string, unknown>,
			);
			if (
				nodeClass === FROM_EXPR_CLASS ||
				nodeClass?.includes('FromExpr')
			) {
				return true;
			}
		}
	}
	return false;
};

const isTypeRelatedKey = (key: number | string | undefined): boolean => {
	if (typeof key !== 'string') return false;
	const lowerKey = key.toLowerCase();
	return (
		lowerKey === 'types' ||
		lowerKey === 'type' ||
		lowerKey === 'typeref' ||
		TYPE_CONTEXT_KEYS_SET.has(lowerKey) ||
		lowerKey.startsWith('type')
	);
};

const isTypeRelatedParentClass = (parentClass: string | undefined): boolean => {
	if (parentClass === undefined) return false;
	return (
		parentClass === TYPEREF_CLASS ||
		parentClass.includes('TypeRef') ||
		(parentClass.includes('Type') && !parentClass.includes('Variable')) ||
		parentClass === FROM_EXPR_CLASS ||
		parentClass.includes('FromExpr') ||
		parentClass.includes('NewExpression') ||
		parentClass.includes('NewObject')
	);
};

const isInTypeContext = (path: Readonly<AstPath<ApexNode>>): boolean => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const { key, stack } = path;
	if (key === 'types') return true;
	if (!Array.isArray(stack)) return false;
	if (typeof key === 'string' && isTypeRelatedKey(key)) return true;
	if (
		typeof key === 'string' &&
		key.toLowerCase() === 'field' &&
		hasFromExprInStack(stack)
	)
		return true;
	if (stack.length < STACK_PARENT_OFFSET) return false;

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const parent = stack[stack.length - STACK_PARENT_OFFSET];
	if (typeof parent !== 'object' || parent == null) return false;
	const parentClass = getNodeClassOptional(parent);
	const hasTypesArray =
		typeof parent === 'object' &&
		'types' in parent &&
		Array.isArray(parent.types);

	if (!isTypeRelatedParentClass(parentClass) && !hasTypesArray) return false;
	return key !== 'name' || !parentClass?.includes('Variable');
};

interface ShouldNormalizeTypeParams {
	readonly forceTypeContext: boolean;
	readonly key: number | string | undefined;
	readonly parentKey: string | undefined;
	readonly path: Readonly<AstPath<ApexNode>>;
}

/**
 * Determines whether a type should be normalized based on context.
 * @param params - Parameters for determining if a type should be normalized.
 * @param params.forceTypeContext - Whether to force type context normalization.
 * @param params.key - The key of the current node.
 * @param params.parentKey - The key of the parent node.
 * @param params.path - The AST path to the current node.
 * @returns True if the type should be normalized, false otherwise.
 * @example
 * ```typescript
 * shouldNormalizeType({
 *   forceTypeContext: true,
 *   key: 'type',
 *   parentKey: 'types',
 *   path: astPath
 * }); // Returns true
 * ```
 */
function shouldNormalizeType(
	params: Readonly<ShouldNormalizeTypeParams>,
): boolean {
	const { forceTypeContext, parentKey, key, path } = params;
	if (forceTypeContext || parentKey === 'types' || key === 'names')
		return true;
	if (typeof key === 'string') {
		const lowerKey = key.toLowerCase();
		if (lowerKey === 'type' || lowerKey === 'typeref' || key === 'types')
			return true;
	}
	return isInTypeContext(path);
}

/**
 * Normalizes a single identifier node's value and prints it.
 * @param node - The identifier node to normalize.
 * @param originalPrint - The original print function.
 * @param subPath - The AST path to the node.
 * @returns The formatted document for the normalized identifier.
 * @example
 * ```typescript
 * normalizeSingleIdentifier(node, originalPrint, subPath);
 * ```
 */
function normalizeSingleIdentifier(
	node: Readonly<ApexIdentifier>,
	originalPrint: (
		path: Readonly<AstPath<ApexNode>>,
		...extraArgs: unknown[]
	) => Doc,
	subPath: Readonly<AstPath<ApexNode>>,
): Doc {
	const nodeValue = node.value;
	if (nodeValue.length === 0) return originalPrint(subPath);
	const normalizedValue = normalizeTypeName(nodeValue);
	if (normalizedValue === nodeValue) return originalPrint(subPath);
	// Check if we're processing an identifier in a TypeRef names array
	// When key === 'names', we're processing identifiers in a names array (likely from a TypeRef)
	// The Doc returned is composite and evaluated lazily, so we shouldn't restore values
	const isInNamesArray = subPath.key === 'names';
	node.value = normalizedValue;
	if (isInNamesArray) {
		// Don't restore values - the Doc is composite and evaluated lazily
		// The AST is already being mutated, so we keep the normalized values
		return originalPrint(subPath);
	}
	// For simple identifiers (not in names arrays), restore values after printing
	try {
		return originalPrint(subPath);
	} finally {
		node.value = nodeValue;
	}
}

/**
 * Normalizes an array of identifier names and prints them.
 * @param node - The node containing the names array to normalize.
 * @param originalPrint - The original print function.
 * @param subPath - The AST path to the node.
 * @returns The formatted document for the normalized names array.
 * @example
 * ```typescript
 * normalizeNamesArray(node, originalPrint, subPath);
 * ```
 */
function normalizeNamesArray(
	node: Readonly<ApexNode & { names?: readonly ApexIdentifier[] }>,
	originalPrint: (
		path: Readonly<AstPath<ApexNode>>,
		...extraArgs: unknown[]
	) => Doc,
	subPath: Readonly<AstPath<ApexNode>>,
): Doc {
	const namesArray = node.names;
	if (!Array.isArray(namesArray)) return originalPrint(subPath);
	// Normalize each identifier in the names array
	let hasChanges = false;
	for (let i = 0; i < namesArray.length; i++) {
		const nameNode = namesArray[i];
		if (
			typeof nameNode !== 'object' ||
			!('value' in nameNode) ||
			typeof nameNode.value !== 'string' ||
			!nameNode.value
		) {
			continue;
		}
		const normalizedValue = normalizeTypeName(nameNode.value);
		if (normalizedValue !== nameNode.value) {
			hasChanges = true;
			nameNode.value = normalizedValue;
		}
	}
	// Don't restore values - the Doc may be evaluated lazily and needs the normalized values
	// The AST is already being mutated, so we keep the normalized values
	return originalPrint(subPath);
}

const createTypeNormalizingPrint =
	(
		originalPrint: (
			path: Readonly<AstPath<ApexNode>>,
			...extraArgs: unknown[]
		) => Doc,
		forceTypeContext = false,
		parentKey?: string,
	) =>
	(subPath: Readonly<AstPath<ApexNode>>, ..._extraArgs: unknown[]): Doc => {
		// Prettier's path.call may pass extra arguments (index, options)
		// but our print function only needs the path - ignore extra args
		// Pass extra args through to originalPrint in case it needs them
		const { node, key } = subPath;
		const normalizedKey = key ?? undefined;
		const shouldNormalize = shouldNormalizeType({
			forceTypeContext,
			key: normalizedKey,
			parentKey,
			path: subPath,
		});
		if (!node) return originalPrint(subPath);
		const isIdent = isIdentifier(node);
		// Note: TypeRef nodes are handled in customPrint (printer.ts) using the interception pattern.
		// When customPrint processes a TypeRef node, it creates namesNormalizingPrint and passes it
		// to originalPrinter.print. The custom print function intercepts when subPath.key === 'names'
		// and uses namesNormalizingPrint. When namesNormalizingPrint processes identifiers in the
		// names array, it will normalize them here (in createTypeNormalizingPrint) because
		// parentKey === 'names' and shouldNormalize will be true.
		// So we don't need to handle TypeRef nodes here - just let the normal flow handle identifiers.

		// Only pass path - originalPrint will receive extra args from Prettier if needed
		if (!shouldNormalize || !isIdent) {
			return originalPrint(subPath);
		}
		const valueField = (node as { value?: unknown }).value;
		if (typeof valueField === 'string') {
			return normalizeSingleIdentifier(
				node as ApexIdentifier,
				originalPrint,
				subPath,
			);
		}
		if ('names' in node) {
			return normalizeNamesArray(
				node as ApexNode & { names?: readonly ApexIdentifier[] },
				originalPrint,
				subPath,
			);
		}
		return originalPrint(subPath, ..._extraArgs);
	};

export {
	normalizeTypeName,
	isIdentifier,
	isInTypeContext,
	createTypeNormalizingPrint,
};
