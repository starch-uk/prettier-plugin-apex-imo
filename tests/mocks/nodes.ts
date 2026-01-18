/**
 * @file Common ApexNode mock factories for testing.
 * Provides reusable factories for creating mock ApexNode structures.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Mock factories for testing don't require strict readonly parameters */
import type {
	ApexNode,
	ApexAnnotationNode,
	ApexAnnotationParameter,
	ApexAnnotationValue,
	ApexIdentifier,
	ApexListInitNode,
	ApexMapInitNode,
} from '../../src/types.js';

/**
 * Node class key used in Apex AST nodes.
 */
const NODE_CLASS_KEY = '@class' as const;

/**
 * Creates a mock Identifier node for testing.
 * @param value - The identifier value to use in the mock node.
 * @returns A mock Identifier node with the specified value.
 * @example
 * ```typescript
 * const node = createMockIdentifier('Account');
 * ```
 */
function createMockIdentifier(value: string): Readonly<ApexIdentifier> {
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.Identifier',
		value,
	} as Readonly<ApexIdentifier>;
}

/**
 * Creates a mock Annotation node for testing.
 * @param name - The annotation name to use in the mock node.
 * @param parameters - Optional array of annotation parameters to include.
 * @returns A mock Annotation node with the specified name and parameters.
 * @example
 * ```typescript
 * const node = createMockAnnotation('Test', []);
 * ```
 */
function createMockAnnotation(
	name: string,
	parameters: Readonly<readonly ApexAnnotationParameter[]> = [],
): Readonly<ApexAnnotationNode> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock factory for testing
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.Modifier$Annotation',
		name: createMockIdentifier(name),
		parameters,
	} as Readonly<ApexAnnotationNode>;
}

/**
 * Creates a mock AnnotationParameter with string value for testing.
 * @param value - The string value to use in the mock parameter.
 * @returns A mock AnnotationParameter node with the specified string value.
 */
function createMockAnnotationStringParameter(
	value: string,
): Readonly<ApexAnnotationParameter> {
	return {
		[NODE_CLASS_KEY]:
			'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
		value,
	} as Readonly<ApexAnnotationParameter>;
}

/**
 * Creates a mock AnnotationParameter with key-value pair for testing.
 * @param key - The parameter key identifier.
 * @param value - The parameter value (can be string, boolean, or AnnotationValue object).
 * @returns A mock AnnotationParameter node with the specified key-value pair.
 */
function createMockAnnotationKeyValueParameter(
	key: string,
	value: Readonly<ApexAnnotationValue> | Readonly<boolean> | Readonly<string>,
): Readonly<ApexAnnotationParameter> {
	const annotationValue: Readonly<ApexAnnotationValue> =
		typeof value === 'string'
			? ({
					[NODE_CLASS_KEY]:
						'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
					value,
				} as Readonly<ApexAnnotationValue>)
			: typeof value === 'boolean'
				? ({
						[NODE_CLASS_KEY]:
							'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue',
					} as Readonly<ApexAnnotationValue>)
				: value;

	return {
		[NODE_CLASS_KEY]:
			'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
		key: createMockIdentifier(key),
		value: annotationValue,
	} as Readonly<ApexAnnotationParameter>;
}

/**
 * Creates a mock TypeRef node for testing.
 * @param names - Array of identifier names that make up the type reference.
 * @returns A mock TypeRef node with the specified names.
 */
function createMockTypeRef(
	names: Readonly<readonly string[]>,
): Readonly<ApexNode> {
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.TypeRef',
		names: names.map((name) => createMockIdentifier(name)),
	} as Readonly<ApexNode>;
}

/**
 * Creates a mock ListInit node for testing.
 * @param values - Array of ApexNode values to include in the list initialization.
 * @returns A readonly ApexListInitNode object with the NewListLiteral class key and the provided values array.
 */
function createMockListInit(
	values: Readonly<readonly ApexNode[]> = [],
): Readonly<ApexListInitNode> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock factory for testing
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.NewObject$NewListLiteral',
		values,
	} as Readonly<ApexListInitNode>;
}

/**
 * Creates a mock SetInit node for testing.
 * @param values - Array of ApexNode values to include in the set initialization.
 * @returns A mock SetInit node with the specified values and proper class key.
 */
function createMockSetInit(
	values: Readonly<readonly ApexNode[]> = [],
): Readonly<ApexListInitNode> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock factory for testing
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.NewObject$NewSetLiteral',
		values,
	} as Readonly<ApexListInitNode>;
}

/**
 * Creates a mock MapInit node for testing.
 * @param pairs - Array of ApexNode key-value pairs to include in the map initialization.
 * @returns A mock MapInit node with the specified pairs.
 */
function createMockMapInit(
	pairs: Readonly<readonly ApexNode[]> = [],
): Readonly<ApexMapInitNode> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock factory for testing
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.NewObject$NewMapLiteral',
		pairs,
	} as Readonly<ApexMapInitNode>;
}

/**
 * Creates a mock BlockComment node for testing.
 * @param value - The comment text content to use in the mock node.
 * @returns A mock BlockComment node with the specified value.
 */
function createMockBlockComment(value: string): Readonly<ApexNode> {
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.parser.impl.HiddenTokens$BlockComment',
		value,
	} as Readonly<ApexNode>;
}

/**
 * Creates a mock MethodDecl node.
 * @param overrides - Optional overrides for the method declaration.
 * @returns A mock MethodDecl node.
 */
function createMockMethodDecl(
	overrides?: Readonly<Partial<ApexNode>>,
): Readonly<ApexNode> {
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.MethodDecl',
		...overrides,
	} as Readonly<ApexNode>;
}

/**
 * Creates a mock VariableDecls node.
 * @param decls - Array of variable declaration nodes.
 * @param modifiers - Array of modifier nodes.
 * @returns A mock VariableDecls node.
 */
function createMockVariableDecls(
	decls: Readonly<readonly ApexNode[]> = [],
	modifiers: Readonly<readonly ApexNode[]> = [],
): Readonly<ApexNode> {
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.VariableDecls',
		decls,
		modifiers,
	} as Readonly<ApexNode>;
}

/**
 * Creates a mock Variable node.
 * @param overrides - Optional overrides for the variable.
 * @returns A mock Variable node.
 */
function createMockVariable(
	overrides?: Readonly<Partial<ApexNode>>,
): Readonly<ApexNode> {
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.Variable',
		...overrides,
	} as Readonly<ApexNode>;
}

/**
 * Creates a mock LiteralExpr node.
 * @returns A mock LiteralExpr node.
 */
function createMockLiteralExpr(): Readonly<ApexNode> {
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.LiteralExpr',
	} as Readonly<ApexNode>;
}

/**
 * Creates a mock MapLiteralKeyValue node.
 * @param key - The key node.
 * @param value - The value node.
 * @returns A mock MapLiteralKeyValue node.
 */
function createMockMapLiteralKeyValue(
	key: Readonly<ApexNode>,
	value: Readonly<ApexNode>,
): Readonly<ApexNode> {
	return {
		[NODE_CLASS_KEY]: 'apex.jorje.data.ast.MapLiteralKeyValue',
		key,
		value,
	} as Readonly<ApexNode>;
}

// Export all functions and constants in a single export declaration
export {
	NODE_CLASS_KEY,
	createMockAnnotation,
	createMockAnnotationKeyValueParameter,
	createMockAnnotationStringParameter,
	createMockBlockComment,
	createMockIdentifier,
	createMockListInit,
	createMockLiteralExpr,
	createMockMapInit,
	createMockMapLiteralKeyValue,
	createMockMethodDecl,
	createMockSetInit,
	createMockTypeRef,
	createMockVariable,
	createMockVariableDecls,
};
