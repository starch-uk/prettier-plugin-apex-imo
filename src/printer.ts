/**
 * @file Creates a wrapped printer that extends the original prettier-plugin-apex printer with custom formatting for annotations, collections, and type references.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { doc } from 'prettier';
import type { AstPath, Doc, ParserOptions } from 'prettier';
import type {
	ApexNode,
	ApexListInitNode,
	ApexMapInitNode,
	ApexAnnotationNode,
} from './types.js';

const { group, indent, softline, ifBreak, line } = doc.builders;
import { isAnnotation, printAnnotation } from './annotations.js';
import {
	normalizeTypeName,
	createTypeNormalizingPrint,
	isIdentifier,
	isInTypeContext,
} from './casing.js';
import { isListInit, isMapInit, printCollection } from './collections.js';
import { getNodeClassOptional } from './utils.js';
import { ARRAY_START_INDEX } from './comments.js';
import {
	extractCodeFromBlock,
	formatCodeBlockDirect,
	formatMultilineCodeBlock,
} from './apexdoc-code.js';
import { FORMAT_FAILED_PREFIX } from './apexdoc.js';

const TYPEREF_CLASS = 'apex.jorje.data.ast.TypeRef';

const isTypeRef = (node: Readonly<ApexNode> | null | undefined): boolean => {
	if (!node || typeof node !== 'object') return false;
	const nodeClass = getNodeClassOptional(node);
	return (
		nodeClass !== undefined &&
		(nodeClass === TYPEREF_CLASS || nodeClass.includes('TypeRef'))
	);
};

/**
 * Make a typeDoc breakable by adding break points at the first comma in generic types.
 * Structure: [baseType, '<', [param1, ', ', param2, ...], '>']
 * We make the first ', ' in the params array breakable.
 * @param typeDoc - The type document to make breakable.
 * @param _options - Parser options (unused but required for consistency).
 * @returns The breakable type document.
 */
const makeTypeDocBreakable = (typeDoc: Doc, _options: Readonly<ParserOptions>): Doc => {
	if (typeof typeDoc === 'string') {
		return typeDoc;
	}
	if (Array.isArray(typeDoc)) {
		// Look for pattern: [baseType, '<', [params...], '>']
		const result: Doc[] = [];
		let i = 0;
		
		while (i < typeDoc.length) {
			const item = typeDoc[i] as Doc;
			
			const ARRAY_OFFSET = 1;
			const FIRST_INDEX = 0;
			// Check if we found '<' followed by an array (type parameters)
			if (item === '<' && i + ARRAY_OFFSET < typeDoc.length && Array.isArray(typeDoc[i + ARRAY_OFFSET])) {
				result.push(item); // '<'
				i++;
				
				// Process the type parameters array
				const params = typeDoc[i] as unknown[];
				const processedParams: Doc[] = [];
				let firstCommaFound = false;
				
				for (let j = FIRST_INDEX; j < params.length; j++) {
					const param = params[j] as Doc;
					if (param === ', ' && !firstCommaFound) {
						// First comma in type parameters - make it breakable
						// Structure: [param1, ', ', group([indent([softline, param2, ...])])]
						processedParams.push(', ');
						// Wrap remaining params in a group with indent and softline
						if (j + ARRAY_OFFSET < params.length) {
							const remainingParams = params.slice(j + ARRAY_OFFSET);
							// Wrap remaining params in a group with indent and softline
							processedParams.push(group(indent([softline, ...remainingParams])));
							break; // Done processing
						}
						firstCommaFound = true;
					} else if (!firstCommaFound) {
						// Before first comma - keep as-is
						processedParams.push(param);
					}
					// After first comma is handled above
				}
				
				result.push(processedParams);
				i++;
			} else {
				result.push(item);
				i++;
			}
		}
		
		return result;
	}
	if (typeof typeDoc === 'object' && typeDoc !== null && 'type' in typeDoc) {
		// It's a doc object (group, indent, etc.) - recurse into contents
		const docObj = typeDoc as { type: string; contents?: unknown; [key: string]: unknown };
		if ('contents' in docObj && docObj.contents !== undefined) {
				return {
					...docObj,
					contents: makeTypeDocBreakable(docObj.contents as Doc, _options),
				} as Doc;
			}
		}
		return typeDoc;
};

// Store current options and originalText for use in printComment
let currentPrintOptions: Readonly<ParserOptions> | undefined = undefined;
let currentOriginalText: string | undefined = undefined;

// Store formatted code blocks keyed by comment value hash
// This allows embed to format code blocks and printComment to retrieve them
const formattedCodeBlocks = new Map<string, string>();

// Store plugin instance for use in embed to ensure wrapped printer is used
let currentPluginInstance: { default: unknown } | undefined = undefined;

/**
 * Export for use in printComment.
 * @param plugin - The plugin instance to store.
 * @param plugin.default - The default export of the plugin.
 * @example
 * setCurrentPluginInstance({ default: plugin });
 */
const setCurrentPluginInstance = (plugin: { default: unknown }): void => {
	currentPluginInstance = plugin;
};

const getCurrentPrintOptions = (): Readonly<ParserOptions> | undefined =>
	currentPrintOptions;

const getCurrentOriginalText = (): string | undefined => currentOriginalText;

const getFormattedCodeBlock = (key: string): string | undefined =>
	formattedCodeBlocks.get(key);

const clearFormattedCodeBlocks = (): void => {
	formattedCodeBlocks.clear();
};

const BLOCK_COMMENT_CLASS = 'apex.jorje.parser.impl.HiddenTokens$BlockComment';
const CODE_TAG = '{@code';
const CODE_TAG_LENGTH = 6;
const NOT_FOUND_INDEX = -1;
const ZERO = 0;
const ONE = 1;
const SINGLE_DECLARATION = 1;

const isCommentNode = (
	node: Readonly<ApexNode> | null | undefined,
): boolean => {
	if (!node || typeof node !== 'object') return false;
	const nodeClass = getNodeClassOptional(node);
	return (
		nodeClass !== undefined &&
		(nodeClass === BLOCK_COMMENT_CLASS ||
			nodeClass.includes('BlockComment') ||
			nodeClass.includes('InlineComment'))
	);
};

const createWrappedPrinter = (
	originalPrinter: Readonly<{
		readonly [key: string]: unknown;
		readonly print: (
			path: Readonly<AstPath<ApexNode>>,
			options: Readonly<ParserOptions>,
			print: (path: Readonly<AstPath<ApexNode>>) => Doc,
		) => Doc;
		readonly embed?: (
			path: AstPath,
			options: ParserOptions,
		) =>
			| Doc
			// eslint-disable-next-line @typescript-eslint/max-params -- Prettier embed API requires 4 parameters
			| ((
					textToDoc: (
						text: string,
						options: ParserOptions,
					) => Promise<Doc>,
					print: (
						selector?:
							| (number | string)[]
							| AstPath
							| number
							| string,
					) => Doc,
					path: AstPath,
					options: ParserOptions,
			  ) => Doc | Promise<Doc | undefined> | undefined)
			| null
			| undefined;
	}>,
): {
	readonly [key: string]: unknown;
	readonly print: (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	) => Doc;
	readonly embed?: (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
	) =>
		| Doc
		// eslint-disable-next-line @typescript-eslint/max-params -- Prettier embed API requires 4 parameters
		| ((
				textToDoc: (
					text: string,
					options: Readonly<ParserOptions>,
				) => Promise<Doc>,
				print: (
					selector?:
						| (number | string)[]
						| Readonly<AstPath<ApexNode>>
						| number
						| string,
				) => Doc,
				path: Readonly<AstPath<ApexNode>>,
				options: Readonly<ParserOptions>,
		  ) => Doc | Promise<Doc | undefined> | undefined)
		| null
		| undefined;
} => {
	const customPrint = (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc => {
		// Store options and originalText for use in printComment
		currentPrintOptions = options;
		currentOriginalText = (options as { originalText?: string })
			.originalText;
		const { node } = path;
		const nodeClass = getNodeClassOptional(node);
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
				options,
			);
		if (isTypeRef(node) && 'names' in node) {
			const namesField = (node as { names?: unknown }).names;

			if (
				Array.isArray(namesField) &&
				namesField.length > ARRAY_START_INDEX
			) {
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
			const normalizedValue = normalizeTypeName(node.value);
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
		// Intercept VariableDecls nodes to enable wrapping for field declarations with or without assignments
		// This handles the full declaration including modifiers and type, so Prettier can evaluate full line length
		if (nodeClass !== undefined && nodeClass === 'apex.jorje.data.ast.VariableDecls') {
			const { decls } = node as { decls?: unknown[] };
			// Check if any declaration has an assignment with a value
			// Even declarations without assignments have an assignment property (object), but it may not have a 'value' property
			const hasAssignments = Array.isArray(decls) && decls.some((decl) => {
				if (!decl || typeof decl !== 'object') return false;
				const { assignment } = decl as { assignment?: unknown };
				// Check if assignment exists and has a 'value' property (real assignment)
				if (assignment === null || assignment === undefined) return false;
				if (typeof assignment !== 'object') return false;
				const assignmentValue = (assignment as { value?: unknown }).value;
				return assignmentValue !== null && assignmentValue !== undefined;
			});
			
			/**
			 * Helper function to check if an assignment is a collection initialization.
			 * @param assignment - The assignment to check.
			 * @returns True if the assignment is a collection initialization.
			 */
			const isCollectionAssignment = (assignment: unknown): boolean => {
				if (!assignment || typeof assignment !== 'object') return false;
				const { value: assignmentValue } = assignment as { value?: unknown };
				if (!assignmentValue || typeof assignmentValue !== 'object' || !('@class' in assignmentValue)) return false;
				const { '@class': assignmentValueClass } = assignmentValue as { '@class': unknown };
				
				// Check if it's a NewExpr (which wraps collection literals)
				if (typeof assignmentValueClass === 'string' && assignmentValueClass === 'apex.jorje.data.ast.Expr$NewExpr') {
					// Check if the NewExpr contains a collection literal
					// The collection literal is in the 'creator' property
					const creator = (assignmentValue as { creator?: unknown }).creator;
					if (creator && typeof creator === 'object' && '@class' in creator) {
						const creatorClass = (creator as { '@class': unknown })['@class'];
						return typeof creatorClass === 'string' && (creatorClass === 'apex.jorje.data.ast.NewObject$NewListLiteral' || creatorClass === 'apex.jorje.data.ast.NewObject$NewSetLiteral' || creatorClass === 'apex.jorje.data.ast.NewObject$NewMapLiteral');
					}
				}
				return false;
			};
			
			if (hasAssignments && Array.isArray(decls)) {
				// Build the structure with proper grouping for wrapping
				// Structure: modifiers + type + [name + group([' =', indent([softline, assignment])])]
				const modifierDocs = path.map(print, 'modifiers' as never) as unknown as Doc[];
				const typeDoc = path.call(print, 'type' as never) as unknown as Doc;
				
				// Process each declaration with wrapping support
				const { join: joinDocs } = doc.builders;
				const declDocs = path.map((declPath: Readonly<AstPath<ApexNode>>) => {
					const declNode = declPath.node;
					if (typeof declNode !== 'object' || declNode === null) {
						return print(declPath);
					}
					
					const assignment = (declNode as { assignment?: unknown }).assignment;
					if (assignment !== null && assignment !== undefined) {
						// Get name and assignment separately - use path.call(print, "assignment", "value") like original
						const nameDoc = declPath.call(print, 'name' as never) as unknown as Doc;
						// Use path.call with two arguments: "assignment", "value" to access nested property
						const assignmentDoc = declPath.call(print, 'assignment' as never, 'value' as never) as unknown as Doc;
						
						// If assignmentDoc exists, create breakable structure
						if (assignmentDoc) {
							// For collection initializations, don't wrap in a way that allows breaking at '='
							// Keep "name = new List<Type>{" together by not using group(indent([softline, ...]))
							// Instead, just return the assignment directly and let the collection handle its own wrapping
							if (isCollectionAssignment(assignment)) {
								return [
									nameDoc,
									' ',
									'=',
									' ',
									assignmentDoc,
								];
							}
							
							// Create breakable structure matching prettier-plugin-apex pattern
							// Use separate string literals for spaces like prettier-plugin-apex does:
							// prettier-plugin-apex uses: [" ", "=", " ", assignmentDocs] for simple case
							// For wrapping, we use: [name, " ", "=", " ", group(indent([softline, assignment]))]
							// The space after = goes outside the group - when group breaks, softline provides newline
							return [
								nameDoc,
								' ',
								'=',
								' ',
								group(indent([softline, assignmentDoc])),
							];
						}
					}
					
					return print(declPath);
				}, 'decls' as never) as unknown as Doc[];
				
				// Combine: modifiers + type + ' ' + decls (joined if multiple) + semicolon
				// Match original prettier-plugin-apex structure which adds semicolon
				const resultParts: Doc[] = [];
				if (modifierDocs.length > 0) {
					resultParts.push(...modifierDocs);
				}
				// For Map types with assignments, keep type together and break at assignment level
				// Check if typeDoc is a Map type with nested Map types or deeply nested structures
				// Examples: Map<String, Map<String, String>> or Map<String, List<Map<String, String>>>
				// NOT: Map<String, List<String>> (simple Map with List value)
				const isComplexMapType = (typeDocToCheck: Doc): boolean => {
					if (typeof typeDocToCheck === 'string') {
						// Check if it's a Map type with nested Map types (not just List/Set)
						return typeDocToCheck.startsWith('Map<') && typeDocToCheck.includes('Map<');
					}
					if (Array.isArray(typeDocToCheck)) {
						const firstElement = typeDocToCheck[ARRAY_START_INDEX];
						const isMap = firstElement === 'Map' || (Array.isArray(firstElement) && firstElement[ARRAY_START_INDEX] === 'Map');
						if (!isMap) return false;
						const TYPE_PARAMS_INDEX = 2;
						// Check if type parameters contain nested Map types (directly or deeply nested)
						if (typeDocToCheck.length > TYPE_PARAMS_INDEX && Array.isArray(typeDocToCheck[TYPE_PARAMS_INDEX])) {
							const params = typeDocToCheck[TYPE_PARAMS_INDEX] as unknown[];
							// Recursively check if any parameter contains nested Map types
							const hasNestedMap = (param: unknown): boolean => {
								if (typeof param === 'string') {
									// Check if string contains nested Map types
									return param.includes('Map<');
								}
								if (Array.isArray(param)) {
									// Check if it's a Map type (nested Map)
									const first = param[ARRAY_START_INDEX];
									if (first === 'Map') return true;
									if (Array.isArray(first) && first[ARRAY_START_INDEX] === 'Map') return true;
									// Recursively check nested structures for Map types
									return param.some((item) => hasNestedMap(item));
								}
								return false;
							};
							return params.some((param) => hasNestedMap(param));
						}
					}
					return false;
				};
				
				// Make typeDoc breakable by adding break points at commas
				// This allows Prettier to break at commas when width exceeds printWidth
				const breakableTypeDoc = makeTypeDocBreakable(typeDoc, options);
				resultParts.push(breakableTypeDoc);
				
				if (declDocs.length > 0) {
					if (declDocs.length > 1) {
						resultParts.push(' ');
						resultParts.push(joinDocs([', ', softline], declDocs));
						resultParts.push(';');
					} else if (declDocs.length === SINGLE_DECLARATION && declDocs[ARRAY_START_INDEX] !== undefined) {
						// Single declaration: extract name and assignment to allow breaking at '='
						const declDoc = declDocs[ARRAY_START_INDEX] as Doc;
						const MIN_DECL_DOC_LENGTH = 5;
						const EQUALS_INDEX = 2;
						const ASSIGNMENT_INDEX = 4;
						// Check if declDoc is an array with the structure [name, ' ', '=', ' ', assignment]
						if (Array.isArray(declDoc) && declDoc.length >= MIN_DECL_DOC_LENGTH && declDoc[EQUALS_INDEX] === '=') {
							const nameDoc = declDoc[ARRAY_START_INDEX] as Doc;
							const assignmentDoc = declDoc[ASSIGNMENT_INDEX] as Doc;
							// Only apply ifBreak for complex Map types to allow breaking at '=' while keeping type together
							if (isComplexMapType(typeDoc)) {
								resultParts.push(' ');
								resultParts.push(group([nameDoc, ' ', '=']));
								const wrappedAssignment = ifBreak(
									indent([line, assignmentDoc]),
									[' ', assignmentDoc]
								);
								resultParts.push(wrappedAssignment);
								resultParts.push(';');
							} else {
								// For non-nested Map types or other types, use original structure
								resultParts.push(' ');
								resultParts.push([declDoc, ';']);
							}
						} else {
							// Fallback: use original structure
							resultParts.push(' ');
							resultParts.push([declDoc, ';']);
						}
					}
				}
				// Wrap in a group to allow breaking when full line exceeds printWidth
				const result = group(resultParts);
				
				return result;
			}
			
			// Handle VariableDecls without assignments - wrap when type + name exceeds printWidth
			if (!hasAssignments && Array.isArray(decls)) {
				const modifierDocs = path.map(print, 'modifiers' as never) as unknown as Doc[];
				const typeDoc = path.call(print, 'type' as never) as unknown as Doc;
				
				// Make typeDoc breakable by adding break points at commas
				const breakableTypeDoc = makeTypeDocBreakable(typeDoc, options);
				
				// Process each declaration - get name docs
				const { join: joinDocs } = doc.builders;
					const nameDocs = path.map((declPath: Readonly<AstPath<ApexNode>>) => {
					const declNode = declPath.node;
					if (typeof declNode !== 'object' || declNode === null) {
						return undefined;
					}
					
					const nameDoc = declPath.call(print, 'name' as never) as unknown as Doc;
					return nameDoc;
				}, 'decls' as never) as unknown as (Doc | undefined)[];
				
				// Combine: modifiers + [type + wrapped name] (joined if multiple) + semicolon
				// The group needs to include modifiers + type + name so Prettier can evaluate full width
				// Structure: modifiers + type + ifBreak(indent([line, name]), [' ', name]) + semicolon
				if (nameDocs.length > 0) {
					if (nameDocs.length > 1) {
						// Multiple declarations: modifiers + type + [name1, name2, ...] + semicolon
						const resultParts: Doc[] = [];
						if (modifierDocs.length > ARRAY_START_INDEX) {
							resultParts.push(...modifierDocs);
						}
						// For each name, create: type + ifBreak(indent([line, name]), [' ', name])
						const typeAndNames = nameDocs.filter((nameDoc): nameDoc is Doc => nameDoc !== undefined).map((nameDoc) => {
							const wrappedName = ifBreak(
								indent([line, nameDoc]),
								[' ', nameDoc]
							);
							return group([breakableTypeDoc, wrappedName]);
						});
						resultParts.push(joinDocs([', ', softline], typeAndNames));
						resultParts.push(';');
						return group(resultParts);
					} else if (nameDocs.length === SINGLE_DECLARATION && nameDocs[ARRAY_START_INDEX] !== undefined) {
						// Single declaration: allow type and name to break independently
						// Type can break at comma, name can break on new line
						const nameDoc = nameDocs[ARRAY_START_INDEX];
						
						// Build: modifiers + type + name + semicolon
						// Don't wrap everything in a single group - allow type and name to break independently
						const resultParts: Doc[] = [];
						if (modifierDocs.length > ARRAY_START_INDEX) {
							resultParts.push(...modifierDocs);
						}
						// Type can break at comma (breakableTypeDoc already has break points)
						resultParts.push(breakableTypeDoc);
						// Name can break on new line using ifBreak
						const wrappedName = ifBreak(
							indent([line, nameDoc]),
							[' ', nameDoc]
						);
						resultParts.push(wrappedName);
						resultParts.push(';');
						
						// Wrap in a group to allow breaking when full line exceeds printWidth
						// The type break point and name break point will be evaluated together
						return group(resultParts);
					}
				}
			}
		}
		// Intercept reassignment statements (Stmnt$ExpressionStmnt with Expr$AssignmentExpr)
		// This handles statements like: localNestedMap = new Map<...>();
		if (nodeClass !== undefined && nodeClass.includes('Stmnt$ExpressionStmnt')) {
			const expr = (node as { expr?: unknown }).expr;
			const exprNodeClass = expr && typeof expr === 'object' && '@class' in expr ? getNodeClassOptional(expr as ApexNode) : undefined;
			const isAssignmentExpr = exprNodeClass !== undefined && exprNodeClass.includes('Expr$AssignmentExpr');
			
			if (isAssignmentExpr && expr && typeof expr === 'object') {
				// Extract left-hand side (variable name) and right-hand side (assignment value)
				// AssignmentExpr structure: { left: ..., right: ... }
				const leftPath = path.call(print, 'expr' as never, 'left' as never) as unknown as Doc;
				const rightPath = path.call(print, 'expr' as never, 'right' as never) as unknown as Doc;
				const assignmentDoc = rightPath;
				
				if (leftPath && assignmentDoc) {
					// Apply H221 pattern: ifBreak(indent([line, assignmentDoc]), [' ', assignmentDoc])
					// Flat mode: [' ', assignmentDoc] - keeps on one line when fits
					// Break mode: indent([line, assignmentDoc]) - wraps with proper indent
					const wrappedAssignment = ifBreak(
						indent([line, assignmentDoc]),
						[' ', assignmentDoc]
					);
					
					// Wrap in group to allow Prettier's fits() to evaluate full line width
					// Include semicolon like the original printer does for statements
					const result = group([
						leftPath,
						' ',
						'=',
						wrappedAssignment,
						';',
					]);
					
					return result;
				}
			}
		}
		return fallback();
	};

	// Custom embed function to handle code blocks in comments
	// This allows us to format code blocks asynchronously using textToDoc
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prettier's embed types are complex
	const customEmbed: any = (path: any, options: any): any => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- path.getNode() is a Prettier API
		const node = path.getNode() as ApexNode;

		// Check if this is a comment node with code blocks
		if (
			isCommentNode(node) &&
			'value' in node &&
			typeof node['value'] === 'string'
		) {
			const commentValue = node['value'];
			const codeTagPos = commentValue.indexOf(CODE_TAG);

			// If comment contains code blocks, return a function to handle them
			if (codeTagPos !== NOT_FOUND_INDEX) {
				// Create a unique key for this comment (using a simple hash of the value)
				// In a real implementation, we'd use node location or a better identifier
				const commentKey = `${String(commentValue.length)}-${String(codeTagPos)}`;

				return async (
					_textToDoc: (
						text: string,
						options: ParserOptions,
					) => Promise<Doc>,
					_print: (
						selector?:
							| (number | string)[]
							| AstPath
							| number
							| string,
					) => Doc,
					_embedPath: AstPath,
					_embedOptions: ParserOptions,
					// eslint-disable-next-line @typescript-eslint/max-params -- Prettier embed API requires 4 parameters
				): Promise<Doc | undefined> => {

					// CRITICAL: Use textToDoc instead of prettier.format
					// textToDoc uses the same printer context (our wrapped printer with type normalization)
					// This ensures type normalization is applied when formatting code blocks
					// Extract and format all code blocks in the comment
					let processedComment = commentValue;
					let searchPos = ZERO;
					const codeBlockReplacements: {
						end: number;
						formatted: string;
						start: number;
					}[] = [];

					// Calculate comment prefix length BEFORE formatting to adjust printWidth
					// Find the {@code line to get its indentation (this is the correct base indentation)
					const codeBlockLineMatch = new RegExp(
						`^(\\s*)\\*\\s*\\{@code`,
						'm',
					).exec(commentValue);
					// Extract base indentation from the {@code line (spaces before asterisk)
					const FIRST_MATCH_GROUP = 1;
					const baseIndent =
						codeBlockLineMatch?.[FIRST_MATCH_GROUP] ?? '';
					// Comment prefix: baseIndent + '* ' (for printing: baseIndent + '* ' + embedded line)
					const commentPrefix = `${baseIndent}* `;
					const commentPrefixLength = commentPrefix.length;
					
					// Adjust printWidth to account for comment prefix
					// Each line will have commentPrefix added, so we need to reduce printWidth
					const originalPrintWidth = _embedOptions.printWidth ?? 80;
					const adjustedPrintWidth = Math.max(
						40, // Minimum reasonable width
						originalPrintWidth - commentPrefixLength,
					);
					
					// Create adjusted embed options with reduced printWidth
					const adjustedEmbedOptions = {
						..._embedOptions,
						printWidth: adjustedPrintWidth,
					};

					while (searchPos < processedComment.length) {
						const tagPos = processedComment.indexOf(
							CODE_TAG,
							searchPos,
						);
						if (tagPos === NOT_FOUND_INDEX) break;

						const extraction = extractCodeFromBlock(
							processedComment,
							tagPos,
						);
						if (!extraction) {
							searchPos = tagPos + CODE_TAG_LENGTH;
							continue;
						}

						const { code, endPos } = extraction;

						// Format the cleanly extracted code directly (no wrapper if possible)
						// This preserves the code's natural structure and indentation
						// Use adjusted embed options with reduced printWidth
						try {
							const formattedCode = await formatCodeBlockDirect({
								code,
								currentPluginInstance,
								embedOptions: adjustedEmbedOptions,
							});

							codeBlockReplacements.push({
								end: endPos,
								formatted: formattedCode,
								start: tagPos,
							});
						} catch (error) {
							// If formatting fails, skip this code block
						}

						searchPos = endPos;
					}

					// Store formatted code blocks for use in printComment
					// Apply replacements in reverse order to maintain positions
					if (codeBlockReplacements.length > ZERO) {
						let finalComment = commentValue;
						// Comment prefix was already calculated above for printWidth adjustment
						// Reuse it here for consistency
						for (
							let i = codeBlockReplacements.length - ONE;
							i >= ZERO;
							i--
						) {
							const replacement = codeBlockReplacements[i];
							if (replacement) {
								const SUBSTRING_START = ZERO;
								const before = finalComment.substring(
									SUBSTRING_START,
									replacement.start,
								);
								const after = finalComment.substring(
									replacement.end,
								);
								// Insert formatted code with newlines to preserve multiline structure
								// Add the comment prefix (` * `) to each line of the formatted code
								// Remove leading whitespace from each line (from Prettier's indentation)
								// and add the comment prefix instead
								// Use formatMultilineCodeBlock for multiline code blocks
								const trimmedFormatted =
									replacement.formatted.trim();
								const formattedWithPrefix =
									replacement.formatted.includes('\n')
										? formatMultilineCodeBlock(
												replacement.formatted,
												commentPrefix,
											)
										: trimmedFormatted.length === ZERO
											? '{@code}'
											: trimmedFormatted.endsWith(';') || trimmedFormatted.startsWith(FORMAT_FAILED_PREFIX)
												? `{@code ${trimmedFormatted} }`
												: `{@code ${trimmedFormatted}}`;
								finalComment =
									before + formattedWithPrefix + after;
							}
						}
						formattedCodeBlocks.set(commentKey, finalComment);
					}

					// Return undefined to let Prettier handle the comment normally
					// printComment will retrieve the formatted version
					return undefined;
				};
			}
		}

		// For non-comment nodes or comments without code blocks, use original embed if it exists

		if (originalPrinter.embed) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- Prettier's embed types are complex
			return (originalPrinter.embed as any)(path, options);
		}

		return undefined;
	};

	const result = {
		...originalPrinter,
		print: customPrint,
	};
	// Wrap embed to handle code blocks in comments
	// If original has embed, we need to call it first, then handle code blocks
	// If original doesn't have embed, we add our custom one
	if (originalPrinter.embed) {
		// Wrap original embed to also handle code blocks
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prettier's embed types are complex
		result.embed = (path: any, options: any): any => {
			// First try our custom logic for code blocks in comments
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- Prettier's embed types are complex
			const customResult = customEmbed(path, options);
			// If we returned a function (for async handling), use that
			if (typeof customResult === 'function') {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Prettier's embed types are complex
				return customResult;
			}
			// If we returned undefined (didn't handle it), try original embed
			// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- Prettier's embed types are complex
			const originalResult = (originalPrinter.embed as any)(
				path,
				options,
			);
			// If original also returned undefined, return undefined
			if (originalResult === undefined) {
				return undefined;
			}
			// If original returned a function, we need to wrap it to also handle code blocks
			if (typeof originalResult === 'function') {
				return async (
					// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prettier embed types are complex
					textToDoc: any,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prettier embed types are complex
					print: any,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prettier embed types are complex
					embedPath: any,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prettier embed types are complex
					embedOptions: any,
					// eslint-disable-next-line @typescript-eslint/max-params, @typescript-eslint/no-explicit-any -- Prettier embed API requires 4 parameters
				): Promise<any> => {
					// Call original embed's async function
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- Prettier's embed types are complex
					const originalDoc = await originalResult(
						textToDoc,
						print,
						embedPath,
						embedOptions,
					);
					// Also try our custom logic (it will return undefined if not a comment with code blocks)
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- Prettier's embed types are complex
					const customDoc = await customEmbed(
						embedPath,
						embedOptions,
					);
					if (typeof customDoc === 'function') {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- Prettier's embed types are complex
						const customResultDoc = await customDoc(
							textToDoc,
							print,
							embedPath,
							embedOptions,
						);
						// If both returned results, prefer custom (code blocks)
						return customResultDoc ?? originalDoc;
					}
					return originalDoc;
				};
			}
			// If original returned a Doc, return it
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Prettier's embed types are complex
			return originalResult;
		};
	} else {
		// No original embed, add our custom one
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Prettier's embed types are complex
		result.embed = customEmbed;
	}
	// @ts-expect-error TS2375 -- exactOptionalPropertyTypes causes type mismatch with Prettier's embed API
	return result;
};

export {
	clearFormattedCodeBlocks,
	createWrappedPrinter,
	getCurrentOriginalText,
	getCurrentPrintOptions,
	getFormattedCodeBlock,
	setCurrentPluginInstance,
};
