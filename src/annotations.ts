/**
 * @file Functions for formatting and normalizing Apex annotations.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import { doc, type AstPath, type Doc } from 'prettier';
import type {
	ApexAnnotationNode,
	ApexAnnotationValue,
	ApexAnnotationKeyValue,
	ApexAnnotationParameter,
} from './types.js';
import {
	APEX_ANNOTATIONS,
	APEX_ANNOTATION_OPTION_NAMES,
} from './refs/annotations.js';
import { EMPTY, getNodeClass, createNodeClassGuard } from './utils.js';

const { group, indent, hardline, softline, join, ifBreak } = doc.builders;

const ANNOTATION_CLASS = 'apex.jorje.data.ast.Modifier$Annotation';
const TRUE_ANNOTATION_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue';
const FALSE_ANNOTATION_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationValue$FalseAnnotationValue';
const ANNOTATION_KEY_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue';

const isAnnotation = createNodeClassGuard<ApexAnnotationNode>(ANNOTATION_CLASS);

const ZERO_INDEX = 0;
const normalizeAnnotationName = (name: string): string =>
	APEX_ANNOTATIONS[name.toLowerCase()] ?? name;

const normalizeAnnotationOptionName = (
	annotationName: string,
	optionName: string,
): string => {
	const annotationKey = annotationName.toLowerCase();
	const optionKey = optionName.toLowerCase();
	const mapping = APEX_ANNOTATION_OPTION_NAMES[annotationKey];
	const normalized = mapping?.[optionKey] ?? optionName;
	return normalized;
};

const isAnnotationKeyValue = (
	param: Readonly<ApexAnnotationParameter>,
): param is Readonly<ApexAnnotationKeyValue> =>
	getNodeClass(param) === ANNOTATION_KEY_VALUE_CLASS;

const isStringAnnotationValue = (
	value: Readonly<ApexAnnotationValue>,
): value is Readonly<ApexAnnotationValue & { value: string }> => {
	// TRUE/FALSE annotation values are handled directly in formatAnnotationValue before calling this function
	// So we don't need to check for them here - they're already filtered out
	if (!('value' in value)) return false;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- AST type access
	const valueProp = (value as { value?: unknown }).value;
	return typeof valueProp === 'string';
};

const formatAnnotationValue = (
	value: Readonly<ApexAnnotationValue>,
): string => {
	const cls = getNodeClass(value);
	if (cls === TRUE_ANNOTATION_VALUE_CLASS) return 'true';
	if (cls === FALSE_ANNOTATION_VALUE_CLASS) return 'false';
	if (isStringAnnotationValue(value)) {
		const stringValue = value.value;
		return stringValue.length > EMPTY ? `'${stringValue}'` : "''";
	}
	return "''";
};

const formatAnnotationParam = (
	param: Readonly<ApexAnnotationParameter>,
	originalName: string,
): Doc => {
	if (isAnnotationKeyValue(param)) {
		const optionKey = param.key.value;
		const normalizedOption = normalizeAnnotationOptionName(
			originalName,
			optionKey,
		);
		return [normalizedOption, '=', formatAnnotationValue(param.value)];
	}
	if ('value' in param) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- AST type access
		const valueProp = (param as { value?: unknown }).value;
		if (typeof valueProp === 'string') {
			return `'${valueProp}'`;
		}
	}
	return "''";
};

const shouldForceMultiline = (_formattedParams: readonly Doc[]): boolean => {
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- minimum count
	return _formattedParams.length > 1;
};

const printAnnotation = (
	path: Readonly<Readonly<AstPath<ApexAnnotationNode>>>,
): Doc => {
	const { node } = path;
	const originalName = node.name.value;
	const normalizedName = normalizeAnnotationName(originalName);
	const parametersLength = node.parameters.length;
	if (parametersLength === EMPTY) return ['@', normalizedName, hardline];
	const formattedParams: Doc[] = node.parameters.map((param) =>
		formatAnnotationParam(param, originalName),
	);

	const forceMultiline = shouldForceMultiline(formattedParams);

	// Annotations use whitespace, not commas, between parameters
	// For multiline, ensure each parameter is a single Doc (group arrays together)
	const paramsForJoin: Doc[] = forceMultiline
		? formattedParams.map((param) =>
				Array.isArray(param) ? group(param) : param,
			)
		: formattedParams;

	if (forceMultiline) {
		// For multiline, treat parameters like a call/argument list:
		// - Wrap the whole annotation in a group
		// - Indent a block that starts with a hardline so each parameter
		//   appears on its own line, indented under the opening parenthesis.
		return group([
			'@',
			normalizedName,
			group([
				'(',
				indent([hardline, join([hardline], paramsForJoin)]),
				hardline,
				')',
			]),
			hardline,
		]);
	}
	const FIRST_PARAM_INDEX = ZERO_INDEX;
	// singleParam cannot be undefined here because:
	// 1. We already checked parametersLength === EMPTY above
	// 2. formatAnnotationParam always returns a Doc (never undefined)
	// 3. So formattedParams.length === parametersLength > 0
	// Non-null assertion safe: singleParam is always defined per above checks
	const singleParam = formattedParams[FIRST_PARAM_INDEX]!;
	return group([
		'@',
		normalizedName,
		group([
			'(',
			ifBreak(indent([softline, singleParam]), singleParam),
			softline,
			')',
		]),
		hardline,
	]);
};

export { isAnnotation, printAnnotation };
