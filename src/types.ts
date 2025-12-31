/* eslint-disable @typescript-eslint/naming-convention */

// Types match the structure from apex-ast-serializer (jorje) in prettier-plugin-apex
// Reference: node_modules/prettier-plugin-apex/vendor/apex-ast-serializer/typings/jorje.d.ts
// These types are compatible with jorje types but use ApexNode[] instead of Expr[] for broader compatibility
// Since apex-ast-serializer types are not directly importable (they're in a vendor directory),
// we maintain these compatible types here. They match the jorje structure exactly.
// The @class properties are part of the external Apex AST structure and cannot be changed.

/**
 * Apex AST node type - represents any Apex AST node
 * Compatible with jorje.Expr structure
 */
export interface ApexNode {
	[key: string]: unknown;
	'@class': string;
}

/**
 * List or Set literal initializer
 * Compatible with jorje.NewListLiteral | jorje.NewSetLiteral
 * Note: jorje uses Expr[] for values, we use ApexNode[] for compatibility
 */
export interface ApexListInitNode {
	[key: string]: unknown;
	'@class':
		| 'apex.jorje.data.ast.NewObject$NewListLiteral'
		| 'apex.jorje.data.ast.NewObject$NewSetLiteral';
	values: ApexNode[];
}

/**
 * Map literal initializer
 * Compatible with jorje.NewMapLiteral structure
 */
export interface ApexMapInitNode {
	[key: string]: unknown;
	'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral';
	pairs: ApexMapPair[];
}

/**
 * Map literal key-value pair
 * Compatible with jorje.MapLiteralKeyValue structure
 * Note: jorje uses Expr for key/value, we use ApexNode for compatibility
 */
export interface ApexMapPair {
	[key: string]: unknown;
	'@class': 'apex.jorje.data.ast.MapLiteralKeyValue';
	key: ApexNode;
	value: ApexNode;
}

/**
 * Annotation node - represents @AnnotationName or @AnnotationName(key=value)
 */
export interface ApexAnnotationNode {
	[key: string]: unknown;
	'@class': 'apex.jorje.data.ast.Modifier$Annotation';
	name: ApexIdentifier;
	parameters: ApexAnnotationParameter[];
}

/**
 * Annotation parameter - can be key-value pair or string
 */
export interface ApexAnnotationParameter {
	[key: string]: unknown;
	'@class':
		| 'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue'
		| 'apex.jorje.data.ast.AnnotationParameter$AnnotationString';
}

/**
 * Annotation key-value pair (e.g., cacheable=true)
 */
export interface ApexAnnotationKeyValue extends ApexAnnotationParameter {
	'@class': 'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue';
	key: ApexIdentifier;
	value: ApexAnnotationValue;
}

/**
 * Annotation string parameter (e.g., for SuppressWarnings)
 */
export interface ApexAnnotationString extends ApexAnnotationParameter {
	'@class': 'apex.jorje.data.ast.AnnotationParameter$AnnotationString';
	value: string;
}

/**
 * Annotation value - boolean or string
 */
export interface ApexAnnotationValue {
	[key: string]: unknown;
	'@class':
		| 'apex.jorje.data.ast.AnnotationValue$FalseAnnotationValue'
		| 'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue'
		| 'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue';
}

/**
 * Identifier node (used in annotation names and keys)
 */
export interface ApexIdentifier {
	[key: string]: unknown;
	'@class': string;
	value: string;
}
