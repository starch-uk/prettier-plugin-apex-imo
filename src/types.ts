import type { AstPath, Doc, ParserOptions, Plugin, Printer } from 'prettier';

/**
 * Apex AST node types we care about for multiline formatting
 */
export interface ApexListInitNode {
	'@class':
		| 'apex.jorje.data.ast.NewObject$NewListLiteral'
		| 'apex.jorje.data.ast.NewObject$NewSetLiteral';
	values: ApexNode[];
	[key: string]: unknown;
}

export interface ApexMapInitNode {
	'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral';
	pairs: ApexMapPair[];
	[key: string]: unknown;
}

export interface ApexMapPair {
	'@class': 'apex.jorje.data.ast.MapLiteralKeyValue';
	key: ApexNode;
	value: ApexNode;
	[key: string]: unknown;
}

export interface ApexNode {
	'@class': string;
	[key: string]: unknown;
}

export type ApexAst = ApexNode;

export interface ApexPrinterOptions extends ParserOptions {
	originalText: string;
}

export type ApexPath = AstPath<ApexNode>;

export type PrintFn = (path: AstPath) => Doc;

export interface ApexPrinter extends Printer<ApexNode> {
	print: (path: ApexPath, options: ApexPrinterOptions, print: PrintFn) => Doc;
}

export interface ApexPlugin extends Plugin<ApexNode> {
	printers: {
		apex: ApexPrinter;
	};
}
