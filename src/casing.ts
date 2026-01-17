/**
 * @file Functions for normalizing Apex type names, including standard object types and primitive types.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { AstPath, Doc } from 'prettier';
import type { ApexNode, ApexIdentifier } from './types.js';
import { STANDARD_OBJECTS } from './refs/standard-objects.js';
import { SORTED_SUFFIXES } from './refs/object-suffixes.js';
import { PRIMITIVE_AND_COLLECTION_TYPES } from './refs/primitive-types.js';
import { APEX_RESERVED_WORDS } from './refs/reserved-words.js';
import { getNodeClassOptional, isObject } from './utils.js';

/**
 * Interface for Prettier print function signature.
 * Reduces parameter count in functions that accept print functions.
 */
// eslint-disable-next-line @typescript-eslint/no-type-alias -- Type alias needed to reduce parameter count in function signatures
type PrintFunction = (
	path: Readonly<AstPath<ApexNode>>,
	...extraArgs: unknown[]
) => Doc;

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

/**
 * Set of Apex reserved words for O(1) lookup performance.
 */
const APEX_RESERVED_WORDS_SET = new Set(
	APEX_RESERVED_WORDS.map((word) => word.toLowerCase()),
);

/**
 * Normalizes a reserved word to lowercase.
 * Reserved words in Apex should always be lowercase (e.g., 'public', 'class', 'static').
 * @param word - The word to normalize (may be in any case).
 * @returns The normalized word in lowercase if it's a reserved word, otherwise the original word.
 * @example
 * ```typescript
 * normalizeReservedWord('PUBLIC'); // Returns 'public'
 * normalizeReservedWord('Class'); // Returns 'class'
 * normalizeReservedWord('STATIC'); // Returns 'static'
 * normalizeReservedWord('MyVariable'); // Returns 'MyVariable' (not a reserved word)
 * ```
 */
const normalizeReservedWord = (word: string): string => {
	if (!word) return word;
	const lowerWord = word.toLowerCase();
	return APEX_RESERVED_WORDS_SET.has(lowerWord) ? lowerWord : word;
};

const normalizeStandardObjectType = (typeName: string): string => {
	if (!typeName) {
		return typeName;
	}
	const lowerTypeName = typeName.toLowerCase();
	const standardObject = STANDARD_OBJECTS[lowerTypeName];
	return standardObject ?? typeName;
};

/**
 * Normalizes a type name by first checking if it's a primitive/collection type, then checking if it's a standard object, then normalizing any object suffix.
 * If the type has a suffix, the prefix is normalized as a standard object (if applicable), then the suffix is normalized.
 * @param typeName - The type name to normalize.
 * @returns The normalized type name.
 * @example
 * ```typescript
 * normalizeTypeName('string'); // Returns 'String'
 * normalizeTypeName('list'); // Returns 'List'
 * normalizeTypeName('account'); // Returns 'Account'
 * normalizeTypeName('MyCustomObject__C'); // Returns 'MyCustomObject__c'
 * normalizeTypeName('account__c'); // Returns 'Account__c'
 * ```
 */

const normalizeTypeName = (typeName: string): string => {
	if (!typeName) return typeName;

	// First, check if it's a primitive or collection type (must be normalized to PascalCase)
	const lowerTypeName = typeName.toLowerCase();
	const primitiveType = PRIMITIVE_AND_COLLECTION_TYPES[lowerTypeName];
	if (primitiveType !== undefined) {
		return primitiveType;
	}

	// Then check if it's a standard object
	const standardNormalized = normalizeStandardObjectType(typeName);
	if (standardNormalized !== typeName) return standardNormalized;

	// Finally, check for object suffixes
	for (const [, normalizedSuffix] of SORTED_SUFFIXES) {
		const lowerSuffix = normalizedSuffix.toLowerCase();
		if (lowerTypeName.endsWith(lowerSuffix)) {
			const prefix = typeName.slice(
				SLICE_START_INDEX,
				typeName.length - lowerSuffix.length,
			);
			return normalizeStandardObjectType(prefix) + normalizedSuffix;
		}
	}
	return typeName;
};

const IDENTIFIER_CLASS = 'apex.jorje.data.ast.Identifier';

const isIdentifier = (
	node: Readonly<ApexNode> | null | undefined,
): node is Readonly<ApexIdentifier> => {
	if (!isObject(node)) return false;
	const nodeClass = getNodeClassOptional(node);
	const isIdentifierClass =
		nodeClass === IDENTIFIER_CLASS || nodeClass?.includes('Identifier');
	if (isIdentifierClass === true) {
		return true;
	}
	return typeof (node as Record<string, unknown>)['value'] === 'string';
};

const STACK_PARENT_OFFSET = 2;

const FROM_EXPR_CLASS = 'apex.jorje.data.ast.FromExpr';
const TYPEREF_CLASS = 'apex.jorje.data.ast.TypeRef';

const hasFromExprInStack = (stack: readonly unknown[]): boolean => {
	for (const item of stack) {
		if (typeof item === 'object' && item !== null && '@class' in item) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- item is confirmed to have @class
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- item is confirmed to have @class
			const nodeClass = getNodeClassOptional(item as ApexNode);
			const isFromExpr =
				nodeClass === FROM_EXPR_CLASS ||
				nodeClass?.includes('FromExpr');
			if (isFromExpr === true) {
				return true;
			}
		}
	}
	return false;
};

const isTypeRelatedKey = (key: string): boolean => {
	// This function is only called when key is already confirmed to be a string
	const lowerKey = key.toLowerCase();
	return (
		lowerKey === 'types' ||
		lowerKey === 'type' ||
		lowerKey === 'typeref' ||
		lowerKey === 'returntype' ||
		lowerKey === 'table' ||
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
	const { key, stack } = path;
	if (key === 'types') return true;
	if (!Array.isArray(stack)) return false;
	if (typeof key === 'string') {
		const lowerKeyString = key.toLowerCase();
		if (
			isTypeRelatedKey(key) ||
			(lowerKeyString === 'field' && hasFromExprInStack(stack))
		) {
			return true;
		}
	}
	if (stack.length < STACK_PARENT_OFFSET) return false;

	const parent = stack[stack.length - STACK_PARENT_OFFSET];
	if (typeof parent !== 'object' || parent === null) return false;
	const parentClass = getNodeClassOptional(parent);
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- 'types' in parent check is necessary for type narrowing
	const hasTypesArray =
		'types' in parent &&
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- parent is confirmed to be object with types property
		Array.isArray((parent as { types?: unknown }).types);

	const hasParentTypeContext =
		isTypeRelatedParentClass(parentClass) || hasTypesArray;
	const parentClassValue = parentClass ?? '';
	const isNotVariableName =
		key !== 'name' || !parentClassValue.includes('Variable');
	return hasParentTypeContext && isNotVariableName;
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
	return (
		forceTypeContext ||
		parentKey === 'types' ||
		key === 'names' ||
		(typeof key === 'string' &&
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-conversion -- key.toLowerCase() result needs comparison
			(key.toLowerCase() === 'type' ||
				key.toLowerCase() === 'typeref' ||
				key === 'types')) ||
		isInTypeContext(path)
	);
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
	originalPrint: PrintFunction,
	subPath: Readonly<AstPath<ApexNode>>,
): Doc {
	const nodeValue = node.value;
	const ZERO_LENGTH = 0;
	if (nodeValue.length === ZERO_LENGTH) return originalPrint(subPath);
	const normalizedValue = normalizeTypeName(nodeValue);
	if (normalizedValue === nodeValue) return originalPrint(subPath);
	const isInNamesArray = subPath.key === 'names';
	(node as { value: string }).value = normalizedValue;
	if (isInNamesArray) {
		return originalPrint(subPath);
	}
	// For simple identifiers (not in names arrays), restore values after printing
	try {
		return originalPrint(subPath);
	} finally {
		(node as { value: string }).value = nodeValue;
	}
}

/**
 * Normalizes a single identifier node's value if it's a reserved word and prints it.
 * @param node - The identifier node to normalize.
 * @param originalPrint - The original print function.
 * @param subPath - The AST path to the node.
 * @returns The formatted document for the normalized identifier.
 * @example
 * ```typescript
 * normalizeReservedWordIdentifier(node, originalPrint, subPath);
 * ```
 */
function normalizeReservedWordIdentifier(
	node: Readonly<ApexIdentifier>,
	originalPrint: PrintFunction,
	subPath: Readonly<AstPath<ApexNode>>,
): Doc {
	const nodeValue = node.value;
	const ZERO_LENGTH = 0;
	if (nodeValue.length === ZERO_LENGTH) return originalPrint(subPath);
	const normalizedValue = normalizeReservedWord(nodeValue);
	if (normalizedValue === nodeValue) return originalPrint(subPath);

	// Mutate the node to use normalized value for printing
	(node as { value: string }).value = normalizedValue;

	// For identifiers that aren't in arrays, restore after printing
	// For arrays, keep normalized value as Doc may be evaluated lazily
	const isInArray = typeof subPath.key === 'number';
	try {
		return originalPrint(subPath);
	} finally {
		if (!isInArray) {
			(node as { value: string }).value = nodeValue;
		}
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
	originalPrint: PrintFunction,
	subPath: Readonly<AstPath<ApexNode>>,
): Doc {
	const namesArray = node.names;
	if (!Array.isArray(namesArray)) return originalPrint(subPath);
	// Normalize each identifier in the names array
	for (const nameNode of namesArray) {
		if (
			typeof nameNode !== 'object' ||
			nameNode === null ||
			!('value' in nameNode)
		) {
			continue;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion -- nameNode is confirmed to have value property
		const nodeValueRaw = (nameNode as { value?: unknown }).value;
		if (typeof nodeValueRaw !== 'string') continue;
		const nodeValue = nodeValueRaw;
		if (nodeValue === '') continue;
		const normalizedValue = normalizeTypeName(nodeValue);
		if (normalizedValue !== nodeValue) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion -- nameNode is confirmed to have value property
			(nameNode as { value: string }).value = normalizedValue;
		}
	}
	// Don't restore values - the Doc may be evaluated lazily and needs the normalized values
	// The AST is already being mutated, so we keep the normalized values
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/max-params -- External printer API uses any types; PrintFunction has parameters
	return originalPrint(subPath);
}

/**
 * Creates a print function that normalizes reserved words in identifiers.
 * Reserved words are normalized to lowercase (e.g., 'PUBLIC' -> 'public', 'Class' -> 'class').
 * @param originalPrint - The original print function.
 * @returns A print function that normalizes reserved words.
 * @example
 * ```typescript
 * const reservedWordNormalizingPrint = createReservedWordNormalizingPrint(originalPrint);
 * ```
 */
// eslint-disable-next-line @typescript-eslint/max-params -- Returned arrow function has 2 parameters (subPath and ...extraArgs), within limit of 3
const createReservedWordNormalizingPrint =
	(originalPrint: PrintFunction) =>
	(subPath: Readonly<AstPath<ApexNode>>, ..._extraArgs: unknown[]): Doc => {
		const { node } = subPath;
		// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition -- node may be null/undefined
		if (!node) return originalPrint(subPath);

		const isIdent = isIdentifier(node);
		if (!isIdent) {
			return originalPrint(subPath, ..._extraArgs);
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- node is confirmed to be Identifier with value
		const valueField = (node as { value?: unknown }).value;
		if (typeof valueField === 'string') {
			return normalizeReservedWordIdentifier(
				node as ApexIdentifier,
				originalPrint,
				subPath,
			);
		}

		return originalPrint(subPath, ..._extraArgs);
		/* eslint-enable @typescript-eslint/max-params */
	};

/**
 * Configuration for type normalization.
 */
interface TypeNormalizationConfig {
	readonly forceTypeContext?: boolean;
	readonly parentKey?: string;
}

// eslint-disable-next-line @typescript-eslint/max-params -- Returned arrow function has 2 parameters (subPath and ...extraArgs), within limit of 3
const createTypeNormalizingPrint =
	(originalPrint: PrintFunction, config: TypeNormalizationConfig = {}) =>
	(subPath: Readonly<AstPath<ApexNode>>, ..._extraArgs: unknown[]): Doc => {
		const { forceTypeContext = false, parentKey } = config;
		const { node, key } = subPath;
		const normalizedKey = key ?? undefined;
		const shouldNormalize = shouldNormalizeType({
			forceTypeContext,
			key: normalizedKey,
			parentKey,
			path: subPath,
		});
		// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition -- node may be null/undefined
		if (!node) return originalPrint(subPath);
		const isIdent = isIdentifier(node);
		// Note: TypeRef nodes are handled in print (printer.ts) using the interception pattern.
		// When print processes a TypeRef node, it creates namesNormalizingPrint and passes it
		// to originalPrinter.print. The custom print function intercepts when subPath.key === 'names'
		// and uses namesNormalizingPrint. When namesNormalizingPrint processes identifiers in the
		// names array, it will normalize them here (in createTypeNormalizingPrint) because
		// parentKey === 'names' and shouldNormalize will be true.
		// So we don't need to handle TypeRef nodes here - just let the normal flow handle identifiers.

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
	normalizeReservedWord,
	normalizeStandardObjectType,
	isIdentifier,
	isInTypeContext,
	createReservedWordNormalizingPrint,
	createTypeNormalizingPrint,
	TYPEREF_CLASS,
};
