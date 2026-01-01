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

const isIdentifier = (
	node: Readonly<ApexNode> | null | undefined,
): node is Readonly<ApexIdentifier> => {
	if (!node || typeof node !== 'object') return false;
	const nodeClass = node['@class'];
	return (
		(typeof nodeClass === 'string' &&
			(nodeClass === 'apex.jorje.data.ast.Identifier' ||
				nodeClass.includes('Identifier'))) ||
		('value' in node &&
			typeof (node as { value?: unknown }).value === 'string')
	);
};

const isInTypeContext = (path: Readonly<AstPath<ApexNode>>): boolean => {
	const { key, stack } = path;
	if (key === 'types') return true;
	if (typeof key === 'string') {
		const lowerKey = key.toLowerCase();
		if (
			lowerKey === 'type' ||
			lowerKey === 'typeref' ||
			lowerKey === 'returntype' ||
			lowerKey === 'table' ||
			lowerKey.startsWith('type')
		)
			return true;
		if (
			lowerKey === 'field' &&
			Array.isArray(stack) &&
			stack.some(
				(a) =>
					typeof a === 'object' &&
					'@class' in a &&
					typeof a['@class'] === 'string' &&
					a['@class'].includes('FromExpr'),
			)
		)
			return true;
	}
	if (Array.isArray(stack) && stack.length >= 2) {
		const parent = stack[stack.length - 2] as Readonly<ApexNode>;
		const parentClass = parent['@class'];
		if (
			typeof parentClass === 'string' &&
			(parentClass.includes('TypeRef') ||
				(parentClass.includes('Type') &&
					!parentClass.includes('Variable')) ||
				parentClass.includes('FromExpr') ||
				('types' in parent && Array.isArray(parent.types)))
		) {
			return key !== 'name' || !parentClass.includes('Variable');
		}
	}
	return false;
};

const isTypeRef = (node: Readonly<ApexNode> | null | undefined): boolean => {
	if (!node || typeof node !== 'object') return false;
	const nodeClass = node['@class'];
	return (
		typeof nodeClass === 'string' &&
		(nodeClass.includes('TypeRef') ||
			nodeClass === 'apex.jorje.data.ast.TypeRef')
	);
};

const createTypeNormalizingPrint =
	(
		originalPrint: (path: Readonly<AstPath<ApexNode>>) => Doc,
		forceTypeContext = false,
		parentKey?: string,
	) =>
	(subPath: Readonly<AstPath<ApexNode>>): Doc => {
		const { node, key } = subPath;
		if (
			!(
				forceTypeContext ||
				parentKey === 'types' ||
				key === 'names' ||
				isInTypeContext(subPath)
			) ||
			!isIdentifier(node)
		)
			return originalPrint(subPath);
		if ('value' in node && typeof node.value === 'string' && node.value) {
			const nodeValue = node.value;
			const normalizedValue = normalizeStandardObjectType(nodeValue);
			if (normalizedValue !== nodeValue) {
				try {
					(node as { value: string }).value = normalizedValue;
					return originalPrint(subPath);
				} finally {
					(node as { value: string }).value = nodeValue;
				}
			}
		} else if (
			'names' in node &&
			Array.isArray((node as { names?: unknown }).names)
		) {
			const namesArray = (
				node as unknown as { names: readonly ApexIdentifier[] }
			).names;
			const originalValues: string[] = [];
			let hasChanges = false;
			try {
				for (let i = 0; i < namesArray.length; i++) {
					const nameNode = namesArray[i];
					if (typeof nameNode === 'object' && 'value' in nameNode) {
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
				if (hasChanges) return originalPrint(subPath);
			} finally {
				for (
					let i = 0;
					i < originalValues.length && i < namesArray.length;
					i++
				) {
					const originalValue = originalValues[i];
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					if (originalValue === undefined) continue;
					const nameNode = namesArray[i];
					if (typeof nameNode === 'object' && 'value' in nameNode) {
						(nameNode as { value: string }).value = originalValue;
					}
				}
			}
		}
		return originalPrint(subPath);
	};

const printCollection = (
	path: Readonly<AstPath<ApexListInitNode | ApexMapInitNode>>,
	print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	originalPrint: () => Doc,
): Doc => {
	const { node } = path;
	const isList = isListInit(node);
	if (
		(isList && !hasMultipleListEntries(node)) ||
		(!isList && !hasMultipleMapEntries(node))
	)
		return originalPrint();
	const typeNormalizingPrint = createTypeNormalizingPrint(
		print,
		true,
		'types',
	);
	const printedTypes = path.map(typeNormalizingPrint, 'types' as never);
	if (isList) {
		const isSet =
			node['@class'] === 'apex.jorje.data.ast.NewObject$NewSetLiteral';
		return group([
			isSet ? 'Set' : 'List',
			'<',
			isSet ? join([',', ' '], printedTypes) : join('.', printedTypes),
			'>',
			group([
				'{',
				indent([
					hardline,
					join([',', hardline], path.map(print, 'values' as never)),
				]),
				hardline,
				'}',
			]),
		]);
	}
	return group([
		'Map<',
		join(', ', printedTypes),
		'>',
		group([
			'{',
			indent([
				hardline,
				join(
					[',', hardline],
					path.map(
						(pairPath: Readonly<AstPath<ApexNode>>) => [
							pairPath.call(print, 'key' as never),
							' => ',
							pairPath.call(print, 'value' as never),
						],
						'pairs' as never,
					),
				),
			]),
			hardline,
			'}',
		]),
	]);
};

const printAnnotation = (path: Readonly<AstPath<ApexAnnotationNode>>): Doc => {
	const { node } = path;
	const originalName = node.name.value;
	const normalizedName = normalizeAnnotationName(originalName);
	if (!node.parameters.length) return ['@', normalizedName, hardline];
	const formattedParams: Doc[] = node.parameters.map((param) =>
		param['@class'] ===
		'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue'
			? [
					normalizeAnnotationOptionName(
						originalName,
						(param as ApexAnnotationKeyValue).key.value,
					),
					'=',
					formatAnnotationValue(
						(param as ApexAnnotationKeyValue).value,
					),
				]
			: `'${(param as unknown as { value: string }).value}'`,
	);
	const forceMultiline =
		['invocablemethod', 'invocablevariable'].includes(
			normalizedName.toLowerCase(),
		) &&
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
};

export const createWrappedPrinter = (
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
} => {
	const customPrint = (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc => {
		const { node } = path;
		const typeNormalizingPrint = createTypeNormalizingPrint(print);
		const fallback = (): Doc =>
			originalPrinter.print(path, options, typeNormalizingPrint);
		if (isAnnotation(node))
			return printAnnotation(
				path as Readonly<AstPath<ApexAnnotationNode>>,
			);
		if (isListInit(node) || isMapInit(node))
			return printCollection(
				path as Readonly<AstPath<ApexListInitNode | ApexMapInitNode>>,
				typeNormalizingPrint,
				fallback,
			);
		if (isTypeRef(node) && 'names' in node) {
			const namesField = (node as { names?: unknown }).names;
			if (Array.isArray(namesField) && namesField.length > 0) {
				const namesNormalizingPrint = createTypeNormalizingPrint(
					print,
					true,
					'names',
				);
				return originalPrinter.print(
					path,
					options,
					(subPath: Readonly<AstPath<ApexNode>>): Doc =>
						subPath.key === 'names'
							? namesNormalizingPrint(subPath)
							: print(subPath),
				);
			}
		}
		if (isIdentifier(node) && isInTypeContext(path)) {
			const normalizedValue = normalizeStandardObjectType(node.value);
			if (normalizedValue !== node.value)
				return originalPrinter.print(
					{
						...path,
						node: { ...node, value: normalizedValue },
					} as Readonly<AstPath<ApexNode>>,
					options,
					typeNormalizingPrint,
				);
		}
		return fallback();
	};
	return { ...originalPrinter, print: customPrint };
};
