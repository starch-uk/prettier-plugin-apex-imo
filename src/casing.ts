/**
 * @file Functions for normalizing Apex type names, including standard object types and primitive types.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type { ApexNode, ApexIdentifier } from './types.js';
import { STANDARD_OBJECTS } from './refs/standard-objects.js';
import { APEX_OBJECT_SUFFIXES } from './refs/object-suffixes.js';
import { getNodeClassOptional } from './utils.js';
import { getCurrentPluginInstance } from './printer.js';

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
	typeof typeName === 'string' && typeName
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
	if (
		nodeClass === IDENTIFIER_CLASS ||
		(nodeClass?.includes('Identifier') ?? false)
	)
		return true;
	return 'value' in node && typeof node['value'] === 'string';
};

const TYPE_CONTEXT_KEYS = ['type', 'typeref', 'returntype', 'table'] as const;
const STACK_PARENT_OFFSET = 2;

const hasFromExprInStack = (stack: readonly unknown[]): boolean =>
	stack.some((a) => {
		if (typeof a !== 'object' || a === null) return false;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Need to assert unknown to ApexNode for type checking
		const aClass = getNodeClassOptional(a as Readonly<ApexNode>);
		return aClass?.includes('FromExpr') ?? false;
	});

const isInTypeContext = (path: Readonly<AstPath<ApexNode>>): boolean => {
	const { key, stack } = path;
	if (key === 'types') return true;
	const isStackArray = Array.isArray(stack);
	if (typeof key === 'string') {
		const lowerKey = key.toLowerCase();
		// Check for type-related keys first (most common case)
		// Variable declarations use 'type' key, constructor calls use 'type' in NewExpression
		if (
			lowerKey === 'type' ||
			lowerKey === 'typeref' ||
			TYPE_CONTEXT_KEYS.includes(
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
				lowerKey as (typeof TYPE_CONTEXT_KEYS)[number],
			) ||
			lowerKey.startsWith('type')
		) {
			return true;
		}
		if (lowerKey === 'field' && isStackArray && hasFromExprInStack(stack))
			return true;
	}
	if (isStackArray && stack.length >= STACK_PARENT_OFFSET) {
		const stackLength = stack.length;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		const parent = stack[
			stackLength - STACK_PARENT_OFFSET
		] as Readonly<ApexNode>;
		const parentClass = getNodeClassOptional(parent);
		if (parentClass === undefined) return false;
		const hasTypesArray =
			typeof parent === 'object' &&
			'types' in parent &&
			Array.isArray(
				(parent as Readonly<ApexNode & { types?: unknown }>).types,
			);
		// Check for variable declaration types and constructor calls
		// Variable declarations have a 'type' key, and constructor calls are in 'NewExpression' nodes
		if (
			parentClass.includes('TypeRef') ||
			(parentClass.includes('Type') &&
				!parentClass.includes('Variable')) ||
			parentClass.includes('FromExpr') ||
			parentClass.includes('NewExpression') ||
			parentClass.includes('NewObject') ||
			hasTypesArray
		) {
			return key !== 'name' || !parentClass.includes('Variable');
		}
	}
	return false;
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
	// Explicitly check for type-related keys (variable declarations, constructor calls)
	const isTypeKey =
		typeof key === 'string' &&
		(key.toLowerCase() === 'type' ||
			key.toLowerCase() === 'typeref' ||
			key === 'types');
	return (
		forceTypeContext ||
		parentKey === 'types' ||
		key === 'names' ||
		isTypeKey ||
		isInTypeContext(path)
	);
}

const EMPTY_STRING_LENGTH = 0;

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
	if (nodeValue.length === EMPTY_STRING_LENGTH) return originalPrint(subPath);
	const normalizedValue = normalizeTypeName(nodeValue);
	if (normalizedValue === nodeValue) return originalPrint(subPath);
	// Check if we're processing an identifier in a TypeRef names array
	// When key === 'names', we're processing identifiers in a names array (likely from a TypeRef)
	// The Doc returned is composite and evaluated lazily, so we shouldn't restore values
	const isInNamesArray = subPath.key === 'names';
	if (isInNamesArray) {
		// Don't restore values - the Doc is composite and evaluated lazily
		// The AST is already being mutated, so we keep the normalized values
		(node as { value: string }).value = normalizedValue;
		return originalPrint(subPath);
	}
	// For simple identifiers (not in names arrays), restore values after printing
	try {
		(node as { value: string }).value = normalizedValue;
		return originalPrint(subPath);
	} finally {
		(node as { value: string }).value = nodeValue;
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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- namesArray is typed as readonly ApexIdentifier[]
		const nameNode = namesArray[i];
		if (typeof nameNode !== 'object' || !('value' in nameNode))
			continue;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		const nameValue = (nameNode as { value?: unknown }).value;
		if (typeof nameValue !== 'string' || !nameValue) continue;
		const normalizedValue = normalizeTypeName(nameValue);
		if (normalizedValue !== nameValue) {
			hasChanges = true;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
			(nameNode as { value: string }).value = normalizedValue;
		}
	}
	if (hasChanges) {
		// Don't restore values - the Doc may be evaluated lazily and needs the normalized values
		// The AST is already being mutated, so we keep the normalized values
		return originalPrint(subPath);
	}
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

/**
 * Normalizes type names in a code string using AST-based parsing.
 * This is used for normalizing code blocks in ApexDoc comments before formatting.
 *
 * Parses the code using the Apex AST parser to identify identifiers in type contexts
 * and normalizes standard object names and object suffixes.
 *
 * @param code - The code string to normalize.
 * @returns The normalized code string with correct type names.
 * @example
 * ```typescript
 * await normalizeTypeNamesInCode('account acc = new account(); List<account> accounts = new List<account>();');
 * // Returns 'Account acc = new Account(); List<Account> accounts = new List<Account>();'
 * ```
 */
const normalizeTypeNamesInCode = async (code: string): Promise<string> => {
	if (!code || typeof code !== 'string') return code;

	try {
		// Parse the code using the Apex anonymous parser
		const pluginWrapper = getCurrentPluginInstance();
		const plugin = pluginWrapper?.default;
		if (!plugin?.parsers?.['apex-anonymous']?.parse) {
			throw new Error('AST parser not available, cannot normalize code');
		}

		const ast = await plugin.parsers['apex-anonymous'].parse(code, {
			parser: 'apex-anonymous',
		});

		// Find all identifiers that should be normalized
		const positions: Array<{ start: number; end: number; original: string; normalized: string }> = [];
		findIdentifiersToNormalize(ast, positions, 0);

		if (positions.length === 0) {
			return code; // No normalization needed
		}

		// Sort by position (reverse order to avoid offset issues)
		positions.sort((a, b) => b.start - a.start);

		// Apply replacements
		let result = code;
		for (const pos of positions) {
			if (pos.start >= 0 && pos.end <= code.length) {
				const before = result.substring(0, pos.start);
				const after = result.substring(pos.end);
				result = before + pos.normalized + after;
			}
		}

		return result;
	} catch (error) {
		// If AST parsing fails, return original code unchanged
		console.warn('Failed to normalize code with AST parsing:', error);
		return code;
	}
};

/**
 * Traverses an AST and collects positions of identifiers that should be normalized
 */
const findIdentifiersToNormalize = (node: any, positions: Array<{ start: number; end: number; original: string; normalized: string }>, offset = 0, path: string[] = []): void => {
	if (!node || typeof node !== 'object') return;

	// Check if this is an identifier node
	if (node['@class'] && node['@class'].includes('Identifier') && node.value && typeof node.value === 'string') {
		const identifier = node.value;

		// Only normalize identifiers that are in type contexts, not variable names
		const isInTypeContext = path.some(segment =>
			segment === 'type' ||
			segment === 'typeref' ||
			segment === 'types' ||
			(segment.includes && segment.includes('type'))
		);

		if (isInTypeContext) {
			const normalized = normalizeTypeName(identifier);

			if (normalized !== identifier && node.loc && typeof node.loc === 'object') {
				// Direct access to location properties
				const startIndex = node.loc.startIndex;
				const endIndex = node.loc.endIndex;

				if (typeof startIndex === 'number' && typeof endIndex === 'number') {
					positions.push({
						start: offset + startIndex,
						end: offset + endIndex,
						original: identifier,
						normalized: normalized
					});
				}
			}
		}
	}

	// Recursively process all properties
	for (const [key, value] of Object.entries(node)) {
		if (Array.isArray(value)) {
			value.forEach((item, index) => findIdentifiersToNormalize(item, positions, offset, [...path, `${key}[${index}]`]));
		} else if (value && typeof value === 'object' && key !== 'loc') { // Skip loc objects to avoid infinite recursion
			findIdentifiersToNormalize(value, positions, offset, [...path, key]);
		}
	}
};


export {
	normalizeTypeName,
	normalizeTypeNamesInCode,
	isIdentifier,
	isInTypeContext,
	createTypeNormalizingPrint,
};
