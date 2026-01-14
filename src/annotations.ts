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

// Annotation normalization uses regex for preprocessing text before parsing (annotation normalization).
// AST manipulation isn't feasible at this stage since we're normalizing annotation names
// in the source text before it reaches the parser.
const ANNOTATION_REGEX =
	/@([a-zA-Z_][a-zA-Z0-9_]*)(\s*\(([^)]*)\)|(?![a-zA-Z0-9_(]))/g;
const ANNOTATION_OPTION_REGEX = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;

const { group, indent, hardline, softline, join, ifBreak } = doc.builders;

const ANNOTATION_CLASS = 'apex.jorje.data.ast.Modifier$Annotation';
const TRUE_ANNOTATION_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue';
const FALSE_ANNOTATION_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationValue$FalseAnnotationValue';
const ANNOTATION_KEY_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue';

const isAnnotation = createNodeClassGuard<ApexAnnotationNode>(ANNOTATION_CLASS);

const normalizeAnnotationName = (name: string): string =>
	APEX_ANNOTATIONS[name.toLowerCase()] ?? name;

const normalizeAnnotationOptionName = (
	annotationName: string,
	optionName: string,
): string =>
	APEX_ANNOTATION_OPTION_NAMES[annotationName.toLowerCase()]?.[
		optionName.toLowerCase()
	] ?? optionName;

const isAnnotationKeyValue = (
	param: Readonly<ApexAnnotationParameter>,
): param is Readonly<ApexAnnotationKeyValue> =>
	getNodeClass(param) === ANNOTATION_KEY_VALUE_CLASS;

const isStringAnnotationValue = (
	value: Readonly<ApexAnnotationValue>,
): value is Readonly<ApexAnnotationValue & { value: string }> => {
	const cls = getNodeClass(value);
	if (
		cls === TRUE_ANNOTATION_VALUE_CLASS ||
		cls === FALSE_ANNOTATION_VALUE_CLASS
	) {
		return false;
	}
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
		return [
			normalizeAnnotationOptionName(originalName, param.key.value),
			'=',
			formatAnnotationValue(param.value),
		];
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

/**
 * Parses and reformats an annotation from a string representation (e.g., from base plugin output).
 * Extracts parameters and reformats them using our normalization rules to ensure consistency
 * with AST-based formatting.
 * @param annotationString - The annotation string to parse.
 * @param lines - Array of lines containing the annotation (for multiline annotations).
 * @param startLineIndex - Index in lines array where the annotation starts.
 * @returns Reformatted annotation lines using our shared formatting rules, or null if parsing fails.
 */
const parseAndReformatAnnotationString = (
	annotationString: string,
	lines: string[],
	startLineIndex: number,
): string[] | null => {
	const nameMatch = /^@([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/.exec(
		annotationString.trim(),
	);
	if (!nameMatch) return null;

	const [, nameGroup] = nameMatch;
	const normalizedName = normalizeAnnotationName(nameGroup ?? '');

	const paramLines: string[] = [];
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- offset
	for (let i = startLineIndex + 1; i < lines.length; i++) {
		const trimmed = lines[i]?.trim();
		if (trimmed === undefined) continue;
		paramLines.push(trimmed);
		if (trimmed.startsWith(')') || trimmed.endsWith(')')) break;
	}

	const parsedParams: { key: string; value: string }[] = [];
	const paramRegex = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*["']([^"']*)["']/;
	for (const pl of paramLines) {
		const match = paramRegex.exec(pl.replace(/,$/, ''));
		if (match) {
			const [, keyGroup, valueGroup] = match;
			parsedParams.push({
				key: keyGroup ?? '',
				value: valueGroup ?? '',
			});
		}
	}

	if (parsedParams.length === EMPTY) return null;

	const formattedParams = parsedParams.map((param, idx) => {
		const normalizedKey = normalizeAnnotationOptionName(
			normalizedName,
			param.key,
		);
		const paramStr = `  ${normalizedKey}='${param.value}'`;
		// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- compare with length
		return idx < parsedParams.length - 1 ? `${paramStr},` : paramStr;
	});

	return [`@${normalizedName}(`, ...formattedParams, ')'];
};

const shouldForceMultiline = (
	_formattedParams: readonly Doc[],
): boolean => {
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
	if (parametersLength === EMPTY)
		return ['@', normalizedName, hardline];
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
	const [singleParam] = formattedParams;
	if (singleParam === undefined) {
		return group(['@', normalizedName, '()']);
	}
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

const createAnnotationReplacer = () => (
	_match: string,
	name: string,
	params?: string,
): string => {
	const normalizedName = normalizeAnnotationName(name);
	if (params === undefined || params.length === EMPTY)
		return `@${normalizedName}`;
	return `@${normalizedName}${params.replace(
		ANNOTATION_OPTION_REGEX,
		(m: string, opt: string) => {
			const normalizedOption = normalizeAnnotationOptionName(
				normalizedName,
				opt,
			);
			return normalizedOption === opt ? m : `${normalizedOption}=`;
		},
	)}`;
};

/**
 * Normalizes annotation names in source text before parsing.
 * Uses character-based parsing instead of regex for annotation normalization.
 * AST manipulation isn't feasible at this stage since we're normalizing annotation names
 * in the source text before it reaches the parser.
 * Skips ApexDoc comments to avoid interfering with ApexDoc annotation normalization.
 * @param text - The source text containing annotations to normalize.
 * @returns The text with normalized annotation names.
 * @example
 * normalizeAnnotationNamesInText('@invocablemethod(label="Test")');
 * // Returns '@InvocableMethod(label="Test")'
 */
const normalizeAnnotationNamesInText = (text: string): string => {
	const replacer = createAnnotationReplacer();
	return text.replace(ANNOTATION_REGEX, replacer);
};

/**
 * Normalizes annotation names in text, excluding ApexDoc annotations.
 * ApexDoc annotations (like \@deprecated, \@param) are preserved as-is.
 * Only Apex code annotations are normalized.
 * @param text - The source text containing annotations to normalize.
 * @returns The text with normalized annotation names (excluding ApexDoc annotations).
 */
const normalizeAnnotationNamesInTextExcludingApexDoc = (
	text: string,
): string => {
	const apexDocAnnotationsSet = new Set([
		'param',
		'return',
		'throws',
		'see',
		'since',
		'author',
		'version',
		'deprecated',
		'group',
		'example',
	]);
	const replacer = createAnnotationReplacer();

	return text.replace(
		ANNOTATION_REGEX,
		(match: string, name: string, params?: string): string => {
			const lowerName = name.toLowerCase();
			if (apexDocAnnotationsSet.has(lowerName)) {
				return params === undefined || params.length === EMPTY
					? `@${lowerName}`
					: `@${lowerName}${params}`;
			}
			return replacer(match, name, params);
		},
	);
};

export {
	isAnnotation,
	normalizeAnnotationNamesInText,
	normalizeAnnotationNamesInTextExcludingApexDoc,
	parseAndReformatAnnotationString,
	printAnnotation,
};
