/* eslint-disable @typescript-eslint/naming-convention */
export interface ApexNode {
	[key: string]: unknown;
	'@class': string;
}

export interface ApexListInitNode extends ApexNode {
	'@class':
		| 'apex.jorje.data.ast.NewObject$NewListLiteral'
		| 'apex.jorje.data.ast.NewObject$NewSetLiteral';
	values: ApexNode[];
}

export interface ApexMapInitNode extends ApexNode {
	'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral';
	pairs: ApexMapPair[];
}

export interface ApexMapPair {
	[key: string]: unknown;
	'@class': 'apex.jorje.data.ast.MapLiteralKeyValue';
	key: ApexNode;
	value: ApexNode;
}

export interface ApexAnnotationNode extends ApexNode {
	'@class': 'apex.jorje.data.ast.Modifier$Annotation';
	name: ApexIdentifier;
	parameters: ApexAnnotationParameter[];
}

export interface ApexAnnotationParameter {
	[key: string]: unknown;
	'@class':
		| 'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue'
		| 'apex.jorje.data.ast.AnnotationParameter$AnnotationString';
}

export interface ApexAnnotationKeyValue extends ApexAnnotationParameter {
	'@class': 'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue';
	key: ApexIdentifier;
	value: ApexAnnotationValue;
}

export interface ApexAnnotationValue {
	[key: string]: unknown;
	'@class':
		| 'apex.jorje.data.ast.AnnotationValue$FalseAnnotationValue'
		| 'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue'
		| 'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue';
}

export interface ApexIdentifier {
	[key: string]: unknown;
	'@class': string;
	value: string;
}
