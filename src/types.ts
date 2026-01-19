/**
 * @file Type definitions for Apex AST nodes.
 */

interface ApexNode {
	[key: string]: unknown;
	'@class': string;
}

interface ApexListInitNode extends ApexNode {
	'@class':
		| 'apex.jorje.data.ast.NewObject$NewListLiteral'
		| 'apex.jorje.data.ast.NewObject$NewSetLiteral';
	values: ApexNode[];
}

interface ApexMapInitNode extends ApexNode {
	'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral';
	pairs: ApexMapPair[];
}

interface ApexMapPair {
	[key: string]: unknown;
	'@class': 'apex.jorje.data.ast.MapLiteralKeyValue';
	key: ApexNode;
	value: ApexNode;
}

interface ApexAnnotationNode extends ApexNode {
	'@class': 'apex.jorje.data.ast.Modifier$Annotation';
	name: ApexIdentifier;
	parameters: ApexAnnotationParameter[];
}

interface ApexAnnotationParameter {
	[key: string]: unknown;
	'@class':
		| 'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue'
		| 'apex.jorje.data.ast.AnnotationParameter$AnnotationString';
}

interface ApexAnnotationKeyValue extends ApexAnnotationParameter {
	'@class': 'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue';
	key: ApexIdentifier;
	value: ApexAnnotationValue;
}

interface ApexAnnotationValue {
	[key: string]: unknown;
	'@class':
		| 'apex.jorje.data.ast.AnnotationValue$FalseAnnotationValue'
		| 'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue'
		| 'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue';
}

interface ApexIdentifier {
	[key: string]: unknown;
	'@class': string;
	value: string;
}

export type {
	ApexNode,
	ApexListInitNode,
	ApexMapInitNode,
	ApexMapPair,
	ApexAnnotationNode,
	ApexAnnotationParameter,
	ApexAnnotationKeyValue,
	ApexAnnotationValue,
	ApexIdentifier,
};
