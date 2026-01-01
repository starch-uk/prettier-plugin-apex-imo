/**
 * @file Functions for formatting and normalizing Apex annotations.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { doc, type AstPath, type Doc } from 'prettier';
import type {
	ApexNode,
	ApexAnnotationNode,
	ApexAnnotationValue,
	ApexAnnotationKeyValue,
	ApexAnnotationParameter,
} from './types.js';
import {
	APEX_ANNOTATIONS,
	APEX_ANNOTATION_OPTION_NAMES,
} from './refs/annotations.js';
import { getNodeClass } from './utils.js';

// Regex is used here for preprocessing text before parsing (annotation normalization).
// AST manipulation isn't feasible at this stage since we're normalizing annotation names
// in the source text before it reaches the parser.
const ANNOTATION_REGEX =
	/@([a-zA-Z_][a-zA-Z0-9_]*)(\s*\(([^)]*)\)|(?![a-zA-Z0-9_(]))/g;
const ANNOTATION_OPTION_REGEX = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
const ZERO_LENGTH = 0;

const { group, indent, hardline, softline, join } = doc.builders;

const ANNOTATION_CLASS = 'apex.jorje.data.ast.Modifier$Annotation';
const TRUE_ANNOTATION_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue';
const FALSE_ANNOTATION_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationValue$FalseAnnotationValue';
const ANNOTATION_KEY_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue';
const MIN_PARAM_LENGTH_FOR_MULTILINE = 40;
const MIN_PARAMS_FOR_MULTILINE = 1;
const EMPTY_PARAMETERS_LENGTH = 0;

const isAnnotation = (
	node: Readonly<ApexNode>,
): node is Readonly<ApexAnnotationNode> =>
	getNodeClass(node) === ANNOTATION_CLASS;

const normalizeAnnotationName = (name: string): string =>
	APEX_ANNOTATIONS[name.toLowerCase()] ?? name;

const normalizeAnnotationOptionName = (
	annotationName: string,
	optionName: string,
): string => {
	const optionMap =
		APEX_ANNOTATION_OPTION_NAMES[annotationName.toLowerCase()];
	return optionMap?.[optionName.toLowerCase()] ?? optionName;
};

const formatAnnotationValue = (
	value: Readonly<ApexAnnotationValue>,
): string => {
	const cls = getNodeClass(value);
	if (cls === TRUE_ANNOTATION_VALUE_CLASS) return 'true';
	if (cls === FALSE_ANNOTATION_VALUE_CLASS) return 'false';
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ApexAnnotationValue has index signature, need assertion to access value
	const valueField = (value as { value?: unknown }).value;
	if (typeof valueField === 'string') {
		return valueField ? `'${valueField}'` : "''";
	}
	return "''";
};

const formatAnnotationParam = (
	param: Readonly<ApexAnnotationParameter>,
	originalName: string,
): Doc => {
	const paramClass = getNodeClass(param);
	if (paramClass === ANNOTATION_KEY_VALUE_CLASS) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		const keyValue = param as ApexAnnotationKeyValue;
		return [
			normalizeAnnotationOptionName(originalName, keyValue.key.value),
			'=',
			formatAnnotationValue(keyValue.value),
		];
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	return `'${(param as unknown as { value: string }).value}'`;
};

const INVOCABLE_ANNOTATIONS = ['invocablemethod', 'invocablevariable'] as const;

const isInvocableAnnotation = (
	name: string,
): name is (typeof INVOCABLE_ANNOTATIONS)[number] =>
	INVOCABLE_ANNOTATIONS.includes(
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- readonly tuple requires assertion for includes
		name as (typeof INVOCABLE_ANNOTATIONS)[number],
	);

const shouldForceMultiline = (
	normalizedName: string,
	formattedParams: readonly Doc[],
): boolean => {
	const normalizedNameLower = normalizedName.toLowerCase();
	if (!isInvocableAnnotation(normalizedNameLower)) return false;
	return (
		formattedParams.length > MIN_PARAMS_FOR_MULTILINE ||
		formattedParams.some(
			(p) =>
				typeof p === 'string' &&
				p.length > MIN_PARAM_LENGTH_FOR_MULTILINE,
		)
	);
};

const printAnnotation = (
	path: Readonly<Readonly<AstPath<ApexAnnotationNode>>>,
): Doc => {
	const { node } = path;
	const originalName = node.name.value;
	const normalizedName = normalizeAnnotationName(originalName);
	const parametersLength = node.parameters.length;
	if (parametersLength === EMPTY_PARAMETERS_LENGTH)
		return ['@', normalizedName, hardline];
	const formattedParams: Doc[] = node.parameters.map((param) =>
		formatAnnotationParam(param, originalName),
	);
	const forceMultiline = shouldForceMultiline(
		normalizedName,
		formattedParams,
	);
	const lineType = forceMultiline ? hardline : softline;
	const paramSeparator = forceMultiline ? [' ', hardline] : [' ', softline];
	return [
		group([
			'@',
			normalizedName,
			group([
				'(',
				indent([lineType, join(paramSeparator, formattedParams)]),
				lineType,
				')',
			]),
		]),
		hardline,
	];
};

/**
 * Normalizes annotation names in source text before parsing.
 * Regex is used here for preprocessing text before parsing (annotation normalization).
 * AST manipulation isn't feasible at this stage since we're normalizing annotation names
 * in the source text before it reaches the parser.
 * @param text - The source text containing annotations to normalize.
 * @returns The text with normalized annotation names.
 * @example
 * ```typescript
 * normalizeAnnotationNamesInText('@invocablemethod(label="Test")');
 * // Returns '@InvocableMethod(label="Test")'
 * ```
 */
const normalizeAnnotationNamesInText = (text: string): string =>
	text.replace(
		ANNOTATION_REGEX,
		(_match: string, name: string, params?: string) => {
			const normalizedName = normalizeAnnotationName(name);
			if (params === undefined || params.length === ZERO_LENGTH)
				return `@${normalizedName}`;
			return `@${normalizedName}${params.replace(
				ANNOTATION_OPTION_REGEX,
				(m: string, opt: string) => {
					const normalized = normalizeAnnotationOptionName(
						normalizedName,
						opt,
					);
					return normalized === opt ? m : `${normalized}=`;
				},
			)}`;
		},
	);

export { isAnnotation, normalizeAnnotationNamesInText, printAnnotation };
