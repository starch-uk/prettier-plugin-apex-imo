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
} from './utils.js';
const { group, indent, hardline, softline, join } = doc.builders;

function printListInit(
	path: Readonly<AstPath<ApexListInitNode>>,
	print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	originalPrint: () => Doc,
): Doc {
	const { node } = path;
	if (!hasMultipleListEntries(node)) return originalPrint();
	const isSet =
		node['@class'] === 'apex.jorje.data.ast.NewObject$NewSetLiteral';
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	const printedTypes = path.map(print, 'types' as never) as Doc[];
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
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	const printedTypes = path.map(print, 'types' as never) as Doc[];
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
		if (isAnnotation(node))
			return printAnnotation(
				path as Readonly<AstPath<ApexAnnotationNode>>,
			);
		if (isListInit(node))
			return printListInit(
				path as Readonly<AstPath<ApexListInitNode>>,
				print,
				() => originalPrinter.print(path, options, print),
			);
		if (isMapInit(node))
			return printMapInit(
				path as Readonly<AstPath<ApexMapInitNode>>,
				print,
				() => originalPrinter.print(path, options, print),
			);
		return originalPrinter.print(path, options, print);
	};
	return { ...originalPrinter, print: customPrint };
}
