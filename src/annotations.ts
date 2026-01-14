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
import { getNodeClass, createNodeClassGuard } from './utils.js';
import { findApexDocComments } from './apexdoc.js';

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
const MIN_PARAMS_FOR_MULTILINE = 1;
const ZERO_LENGTH = 0;
const ONE_INDEX = 1;
const STRING_START_INDEX = 0;
const KEY_GROUP_INDEX = 1;
const VALUE_GROUP_INDEX = 2;
const NEXT_LINE_OFFSET = 1;
const ANNOTATION_PARAM_INDENT = 2;

const isAnnotation = createNodeClassGuard<ApexAnnotationNode>(ANNOTATION_CLASS);

const normalizeAnnotationName = (name: string): string => {
	const lowerName = name.toLowerCase();
	const annotation = APEX_ANNOTATIONS[lowerName];
	return annotation !== undefined ? annotation : name;
};

const normalizeAnnotationOptionName = (
	annotationName: string,
	optionName: string,
): string => {
	const optionMap =
		APEX_ANNOTATION_OPTION_NAMES[annotationName.toLowerCase()];
	if (optionMap === undefined) {
		return optionName;
	}
	const lowerOptionName = optionName.toLowerCase();
	const normalizedOption = optionMap[lowerOptionName];
	return normalizedOption !== undefined ? normalizedOption : optionName;
};

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
		return stringValue ? `'${stringValue}'` : "''";
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

	const nameGroup = nameMatch[ONE_INDEX];
	const normalizedName = normalizeAnnotationName(nameGroup !== undefined ? nameGroup : '');

	// Collect parameter lines until closing paren
	const paramLines: string[] = [];
	for (let i = startLineIndex + NEXT_LINE_OFFSET; i < lines.length; i++) {
		if (i < 0 || i >= lines.length) {
			continue;
		}
		const trimmed = lines[i].trim();
		paramLines.push(trimmed);
		if (trimmed.startsWith(')') || trimmed.endsWith(')')) break;
	}

	// Parse parameters: key="value" or key='value'
	const parsedParams: { key: string; value: string }[] = [];
	const paramRegex = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*["']([^"']*)["']/;
	for (const pl of paramLines) {
		const match = paramRegex.exec(pl.replace(/,$/, ''));
		if (match) {
			const keyGroup = match[KEY_GROUP_INDEX];
			const valueGroup = match[VALUE_GROUP_INDEX];
			parsedParams.push({
				key: keyGroup !== undefined ? keyGroup : '',
				value: valueGroup !== undefined ? valueGroup : '',
			});
		}
	}

	if (parsedParams.length === ZERO_LENGTH) return null;

	// Reformat with normalization (consistent with AST-based formatAnnotationValue)
	const indentSpaces = ' '.repeat(ANNOTATION_PARAM_INDENT);
	const formattedParams = parsedParams.map((param, idx) => {
		const normalizedKey = normalizeAnnotationOptionName(
			normalizedName,
			param.key,
		);
		const paramStr = `${normalizedKey}='${param.value}'`;
		return idx < parsedParams.length - 1
			? `${indentSpaces}${paramStr},`
			: `${indentSpaces}${paramStr}`;
	});

	return [`@${normalizedName}(`, ...formattedParams, ')'];
};

const shouldForceMultiline = (
	_normalizedName: string,
	formattedParams: readonly Doc[],
): boolean => formattedParams.length > MIN_PARAMS_FOR_MULTILINE;

const printAnnotation = (
	path: Readonly<Readonly<AstPath<ApexAnnotationNode>>>,
): Doc => {
	const { node } = path;
	const originalName = node.name.value;
	const normalizedName = normalizeAnnotationName(originalName);
	const parametersLength = node.parameters.length;
	if (parametersLength === ZERO_LENGTH)
		return ['@', normalizedName, hardline];
	const formattedParams: Doc[] = node.parameters.map((param) =>
		formatAnnotationParam(param, originalName),
	);

	const forceMultiline = shouldForceMultiline(
		normalizedName,
		formattedParams,
	);

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
	// Single-line: use group with ifBreak to allow breaking if it exceeds printWidth
	// eslint-disable-next-line @typescript-eslint/no-magic-numbers, @typescript-eslint/prefer-destructuring -- array index, single param access
	const singleParam = formattedParams[0];
	if (singleParam === undefined) {
		return group(['@', normalizedName, '()']);
	}
	const singleParamDoc: Doc = Array.isArray(singleParam)
		? singleParam
		: singleParam;
	return group([
		'@',
		normalizedName,
		group([
			'(',
			ifBreak(
				// Break: put param on its own indented line
				indent([softline, singleParamDoc]),
				// Flat: keep param on same line (no extra whitespace)
				singleParamDoc,
			),
			softline,
			')',
		]),
		hardline,
	]);
};

const createAnnotationReplacer =
	() =>
	(_match: string, name: string, params?: string): string => {
		const normalizedName = normalizeAnnotationName(name);
		if (params === undefined || params.length === ZERO_LENGTH)
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
	const apexDocComments = findApexDocComments(text);
	const replacer = createAnnotationReplacer();
	// If no ApexDoc comments, process entire text
	if (apexDocComments.length === ZERO_LENGTH) {
		return text.replace(ANNOTATION_REGEX, replacer);
	}

	// Process text in segments, skipping ApexDoc comments
	let result = text;
	let lastIndex = 0;
	const segments: { start: number; end: number; isComment: boolean }[] = [];

	// Build segments
	for (const comment of apexDocComments) {
		if (lastIndex < comment.start) {
			segments.push({
				end: comment.start,
				isComment: false,
				start: lastIndex,
			});
		}
		segments.push({
			end: comment.end,
			isComment: true,
			start: comment.start,
		});
		lastIndex = comment.end;
	}
	if (lastIndex < text.length) {
		segments.push({ end: text.length, isComment: false, start: lastIndex });
	}

	// Process non-comment segments
	for (let i = segments.length - ONE_INDEX; i >= 0; i--) {
		const segment = segments[i];
		if (!segment || segment.isComment) continue;

		const segmentText = text.substring(segment.start, segment.end);
		const normalized = segmentText.replace(ANNOTATION_REGEX, replacer);

		if (normalized !== segmentText) {
			result =
				result.substring(STRING_START_INDEX, segment.start) +
				normalized +
				result.substring(segment.end);
		}
	}

	return result;
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
	// Import APEXDOC_ANNOTATIONS dynamically to avoid circular dependency
	const APEXDOC_ANNOTATIONS = [
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
	] as const;

	const apexDocAnnotationsSet = new Set<string>([...APEXDOC_ANNOTATIONS]);
	const replacer = createAnnotationReplacer();

	/**
	 * Create a replacer that normalizes ApexDoc annotations to lowercase, not PascalCase.
	 * @param match - The full regex match.
	 * @param name - The annotation name.
	 * @param params - Optional parameters string.
	 * @returns The normalized annotation string.
	 */
	const excludingApexDocReplacer = (
		match: string,
		name: string,
		params?: string,
	): string => {
		const lowerName = name.toLowerCase();
		// If it's an ApexDoc annotation, normalize to lowercase (not PascalCase)
		if (apexDocAnnotationsSet.has(lowerName)) {
			if (params === undefined || params.length === ZERO_LENGTH) {
				return `@${lowerName}`;
			}
			return `@${lowerName}${params}`;
		}
		// Otherwise, normalize it to PascalCase (Apex code annotations)
		return replacer(match, name, params);
	};

	return text.replace(ANNOTATION_REGEX, excludingApexDocReplacer);
};

export {
	isAnnotation,
	normalizeAnnotationNamesInText,
	normalizeAnnotationNamesInTextExcludingApexDoc,
	parseAndReformatAnnotationString,
	printAnnotation,
};
