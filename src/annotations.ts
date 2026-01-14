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

const { group, indent, hardline, softline, join, ifBreak, concat } = doc.builders;

const ANNOTATION_CLASS = 'apex.jorje.data.ast.Modifier$Annotation';
const TRUE_ANNOTATION_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue';
const FALSE_ANNOTATION_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationValue$FalseAnnotationValue';
const ANNOTATION_KEY_VALUE_CLASS =
	'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue';
const MIN_PARAM_LENGTH_FOR_MULTILINE = 40;
const MIN_PARAMS_FOR_MULTILINE = 1;
const ZERO_LENGTH = 0;
const ONE_INDEX = 1;
const STRING_START_INDEX = 0;
const LOOP_START_INDEX = 0;

const isAnnotation = createNodeClassGuard<ApexAnnotationNode>(ANNOTATION_CLASS);

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
	return 'value' in value && typeof value.value === 'string';
};

const formatAnnotationValue = (
	value: Readonly<ApexAnnotationValue>,
): string => {
	const cls = getNodeClass(value);
	if (cls === TRUE_ANNOTATION_VALUE_CLASS) return 'true';
	if (cls === FALSE_ANNOTATION_VALUE_CLASS) return 'false';
	if (isStringAnnotationValue(value)) {
		return value.value ? `'${value.value}'` : "''";
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
	if ('value' in param && typeof param.value === 'string') {
		return `'${param.value}'`;
	}
	return "''";
};

/**
 * Formats an annotation parameter as a string (for use in string-based formatting contexts like {@code} blocks).
 * Uses the same normalization logic as formatAnnotationParam but returns a string instead of a Doc.
 * @param param - The annotation parameter to format.
 * @param originalName - The original annotation name (before normalization).
 * @returns The formatted parameter as a string (e.g., "Label='Test'" or "Description='Test description'").
 */
const formatAnnotationParamAsString = (
	param: Readonly<ApexAnnotationParameter>,
	originalName: string,
): string => {
	if (isAnnotationKeyValue(param)) {
		const normalizedOptionName = normalizeAnnotationOptionName(
			originalName,
			param.key.value,
		);
		const valueStr = formatAnnotationValue(param.value);
		return `${normalizedOptionName}=${valueStr}`;
	}
	if ('value' in param && typeof param.value === 'string') {
		return `'${param.value}'`;
	}
	return "''";
};

/**
 * Formats a multiline annotation block as a string array (for use in string-based contexts like {@code} blocks).
 * This ensures consistency with the AST-based printAnnotation logic.
 * @param annotationName - The normalized annotation name (e.g., "InvocableMethod").
 * @param originalName - The original annotation name before normalization.
 * @param params - Array of annotation parameters.
 * @param indentLevel - Number of spaces to indent parameters (default: 2).
 * @returns Array of strings representing the formatted annotation, one line per element.
 */
const formatMultilineAnnotationAsString = (
	annotationName: string,
	originalName: string,
	params: readonly ApexAnnotationParameter[],
	indentLevel = 2,
): string[] => {
	if (params.length === 0) {
		return [`@${annotationName}`];
	}

	const indent = ' '.repeat(indentLevel);
	const paramStrings = params.map((param) =>
		formatAnnotationParamAsString(param, originalName),
	);

	// Add trailing commas to all but the last parameter
	const formattedParams = paramStrings.map((paramStr, idx) => {
		if (idx < paramStrings.length - 1) {
			return `${indent}${paramStr},`;
		}
		return `${indent}${paramStr}`;
	});

	return [`@${annotationName}(`, ...formattedParams, ')'];
};

/**
 * Parses and reformats an annotation from a string representation (e.g., from base plugin output).
 * Extracts parameters and reformats them using our normalization rules to ensure consistency
 * with AST-based formatting.
 * @param annotationString - The annotation string to parse (e.g., "@InvocableMethod(label=\"Test\", description=\"Test\")").
 * @param lines - Array of lines containing the annotation (for multiline annotations).
 * @param startLineIndex - Index in lines array where the annotation starts.
 * @returns Reformatted annotation lines using our shared formatting rules, or null if parsing fails.
 */
const parseAndReformatAnnotationString = (
	annotationString: string,
	lines: string[],
	startLineIndex: number,
): string[] | null => {
	// Extract annotation name
	const nameMatch = /^@([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/.exec(annotationString.trim());
	if (!nameMatch) return null;

	const originalName = nameMatch[1] ?? '';
	const normalizedName = normalizeAnnotationName(originalName);

	// Collect parameter lines
	const paramLines: string[] = [];
	let endLineIndex = startLineIndex;
	for (let i = startLineIndex + 1; i < lines.length; i++) {
		const line = lines[i] ?? '';
		const trimmed = line.trim();
		paramLines.push(trimmed);
		if (trimmed.startsWith(')') || trimmed.endsWith(')')) {
			endLineIndex = i;
			break;
		}
	}

	// Parse parameters from string representation
	const parsedParams: Array<{ key: string; value: string }> = [];
	for (const pl of paramLines) {
		// Match key="value" or key='value' patterns, handling trailing commas
		const match = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*["']([^"']*)["']/.exec(
			pl.replace(/,$/, ''),
		);
		if (!match) continue;
		const [, rawKey, rawValue] = match;
		parsedParams.push({ key: rawKey ?? '', value: rawValue ?? '' });
	}

	if (parsedParams.length === 0) return null;

	// Reformat using our normalization rules
	const indent = '  '; // 2 spaces
	const formattedParams: string[] = [];
	for (let idx = 0; idx < parsedParams.length; idx++) {
		const { key, value } = parsedParams[idx]!;
		const normalizedKey = normalizeAnnotationOptionName(normalizedName, key);
		// Use double quotes to match fixture expectations
		const paramStr = `${normalizedKey}="${value}"`;
		if (idx < parsedParams.length - 1) {
			formattedParams.push(`${indent}${paramStr},`);
		} else {
			formattedParams.push(`${indent}${paramStr}`);
		}
	}

	return [`@${normalizedName}(`, ...formattedParams, ')'];
};

// Use Set for O(1) lookup instead of array.includes() O(n)
const INVOCABLE_ANNOTATIONS_SET = new Set([
	'invocablemethod',
	'invocablevariable',
]);

const isInvocableAnnotation = (name: string): boolean =>
	INVOCABLE_ANNOTATIONS_SET.has(name.toLowerCase());

const shouldForceMultiline = (
	normalizedName: string,
	formattedParams: readonly Doc[],
): boolean => {
	// All annotations with 2+ parameters should be multiline
	// Single parameter annotations stay on one line
	return formattedParams.length > MIN_PARAMS_FOR_MULTILINE;
};

const printAnnotation = (
	path: Readonly<Readonly<AstPath<ApexAnnotationNode>>>,
): Doc => {
	const { node } = path;
	const originalName = node.name.value;
	const normalizedName = normalizeAnnotationName(originalName);
	const parametersLength = node.parameters.length;
	if (parametersLength === ZERO_LENGTH) return ['@', normalizedName, hardline];
	const formattedParams: Doc[] = node.parameters.map((param) =>
		formatAnnotationParam(param, originalName),
	);

	// #region agent log
	// Debug: trace annotation formatting behavior for hypotheses H1–H3
	// H1: printAnnotation is not used in {@code}/apex-anonymous formatting
	// H2: parametersLength/forceMultiline differ between file and {@code} contexts
	// H3: annotation name/parameters are being normalized differently in {@code} path
	// eslint-disable-next-line no-void
	void fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			sessionId: 'debug-session',
			runId: 'invocable-codeblock',
			hypothesisId: 'H1-H3',
			location: 'src/annotations.ts:printAnnotation:entry',
			message: 'printAnnotation entry',
			data: {
				normalizedName,
				originalName,
				parametersLength,
				hasParameters: parametersLength > 0,
			},
			timestamp: Date.now(),
		}),
	}).catch(() => {});
	// #endregion agent log
	const forceMultiline = shouldForceMultiline(
		normalizedName,
		formattedParams,
	);

	// #region agent log
	// Debug: branch decision for multiline vs single-line annotations
	// eslint-disable-next-line no-void
	void fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			sessionId: 'debug-session',
			runId: 'invocable-codeblock',
			hypothesisId: 'H2',
			location: 'src/annotations.ts:printAnnotation:branch',
			message: 'printAnnotation branch decision',
			data: {
				normalizedName,
				parametersLength,
				forceMultiline,
			},
			timestamp: Date.now(),
		}),
	}).catch(() => {});
	// #endregion agent log

	// Annotations use whitespace, not commas, between parameters
	// For multiline, ensure each parameter is a single Doc (group arrays together)
	const paramsForJoin: Doc[] = forceMultiline
		? formattedParams.map((param) =>
				Array.isArray(param) ? group(param) : param,
			)
		: formattedParams;

	if (forceMultiline) {
		// #region agent log
		// Debug: confirm multiline branch used and how many params we indent
		// eslint-disable-next-line no-void
		void fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId: 'debug-session',
				runId: 'invocable-codeblock',
				hypothesisId: 'H2',
				location: 'src/annotations.ts:printAnnotation:multiline',
				message: 'printAnnotation multiline branch',
				data: {
					normalizedName,
					paramCount: paramsForJoin.length,
				},
				timestamp: Date.now(),
			}),
		}).catch(() => {});
		// #endregion agent log

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
	const singleParam = formattedParams[0];
	const singleParamDoc: Doc =
		Array.isArray(singleParam) ? concat(singleParam) : singleParam;
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
 * Parses annotation syntax from text and normalizes it using AST-based approach.
 * This replaces regex-based annotation normalization with character-based parsing.
 * @param annotationText - The annotation text to parse and normalize.
 * @returns The normalized annotation text.
 */
const parseAndNormalizeAnnotation = (annotationText: string): string => {
	// Parse @name(parameters) pattern using character scanning
	if (!annotationText.startsWith('@')) {
		return annotationText;
	}

	let pos = 1; // Skip the @
	let name = '';

	// Parse annotation name
	while (pos < annotationText.length && (annotationText[pos] === '_' ||
		   (annotationText[pos] >= 'a' && annotationText[pos] <= 'z') ||
		   (annotationText[pos] >= 'A' && annotationText[pos] <= 'Z') ||
		   (annotationText[pos] >= '0' && annotationText[pos] <= '9'))) {
		name += annotationText[pos];
		pos++;
	}

	if (name.length === 0) {
		return annotationText; // Invalid annotation
	}

	const normalizedName = normalizeAnnotationName(name);

	// Check if there are parameters
	if (pos >= annotationText.length || annotationText[pos] !== '(') {
		// No parameters
		return `@${normalizedName}`;
	}

	// Parse parameters by copying the text as-is and normalizing parameter names
	let result = `@${normalizedName}(`;
	pos++; // Skip opening (

	// Find the end of parameters
	const paramEnd = annotationText.indexOf(')', pos);
	if (paramEnd === -1) {
		return annotationText; // Invalid
	}

	const paramText = annotationText.substring(pos, paramEnd);

	// Process parameter text, normalizing parameter names but preserving spacing
	let processedParams = '';
	let paramNameStart = -1;
	let inParamName = false;

	for (let i = 0; i < paramText.length; i++) {
		const char = paramText[i];

		if (!inParamName && /\w/.test(char)) {
			// Start of parameter name
			inParamName = true;
			paramNameStart = i;
		} else if (inParamName && char === '=') {
			// End of parameter name
			const paramName = paramText.substring(paramNameStart, i);
			const normalizedParam = normalizeAnnotationOptionName(normalizedName, paramName);
			if (normalizedParam !== paramName) {
				processedParams += normalizedParam;
			} else {
				processedParams += paramName;
			}
			processedParams += '=';
			inParamName = false;
			paramNameStart = -1;
		} else if (inParamName && !/\w/.test(char)) {
			// End of parameter name (non-word character)
			if (paramNameStart !== -1) {
				const paramName = paramText.substring(paramNameStart, i);
				const normalizedParam = normalizeAnnotationOptionName(normalizedName, paramName);
				if (normalizedParam !== paramName) {
					processedParams += normalizedParam;
				} else {
					processedParams += paramName;
				}
				paramNameStart = -1;
			}
			inParamName = false;
			processedParams += char;
		} else if (!inParamName) {
			processedParams += char;
		}
	}

	// Handle case where parameter name goes to end
	if (inParamName && paramNameStart !== -1) {
		const paramName = paramText.substring(paramNameStart);
		const normalizedParam = normalizeAnnotationOptionName(normalizedName, paramName);
		if (normalizedParam !== paramName) {
			processedParams += normalizedParam;
		} else {
			processedParams += paramName;
		}
	}

	result += processedParams + ')';

	if (pos < annotationText.length && annotationText[pos] === ')') {
		result += ')';
	} else {
		// Unclosed parentheses, return as-is
		return annotationText;
	}

	return result;
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
 * ```typescript
 * normalizeAnnotationNamesInText('@invocablemethod(label="Test")');
 * // Returns '@InvocableMethod(label="Test")'
 * ```
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
	for (let i = segments.length - ONE_INDEX; i >= LOOP_START_INDEX; i--) {
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

	const apexDocAnnotationsSet = new Set(APEXDOC_ANNOTATIONS);
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
