/**
 * @file Creates a wrapped printer that extends the original prettier-plugin-apex printer with custom formatting for annotations, collections, and type references.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { doc } from 'prettier';
import * as prettier from 'prettier';
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
	createTypeNormalizingPrint,
	isIdentifier,
	isInTypeContext,
	normalizeTypeName,
} from './casing.js';
import { isListInit, isMapInit, printCollection } from './collections.js';
import { getNodeClassOptional, createNodeClassGuard, startsWithAccessModifier } from './utils.js';
import { ARRAY_START_INDEX } from './comments.js';
import {
	extractCodeFromBlock,
	CODE_TAG,
	CODE_TAG_LENGTH,
} from './apexdoc-code.js';

const TYPEREF_CLASS = 'apex.jorje.data.ast.TypeRef';

const isTypeRef = createNodeClassGuard<ApexNode>(
	(cls) =>
		cls !== undefined && (cls === TYPEREF_CLASS || cls.includes('TypeRef')),
);

/**
 * Make a typeDoc breakable by adding break points at the first comma in generic types.
 * Structure: [baseType, '<', [param1, ', ', param2, ...], '>']
 * We make the first ', ' in the params array breakable.
 * @param typeDoc - The type document to make breakable.
 * @param _options - Parser options (unused but required for consistency).
 * @returns The breakable type document.
 */
const makeTypeDocBreakable = (
	typeDoc: Doc,
	_options: Readonly<ParserOptions>,
): Doc => {
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
			if (
				item === '<' &&
				i + ARRAY_OFFSET < typeDoc.length &&
				Array.isArray(typeDoc[i + ARRAY_OFFSET])
			) {
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
							const remainingParams = params.slice(
								j + ARRAY_OFFSET,
							) as Doc[];
							// Wrap remaining params in a group with indent and softline
							processedParams.push(
								group(indent([softline, ...remainingParams])),
							);
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
		const docObj = typeDoc as {
			type: string;
			contents?: unknown;
			[key: string]: unknown;
		};
		if ('contents' in docObj && docObj.contents !== undefined) {
			return {
				...docObj,
				contents: makeTypeDocBreakable(
					docObj.contents as Doc,
					_options,
				),
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

const getCurrentPluginInstance = (): { default: unknown } | undefined =>
	currentPluginInstance;

const getFormattedCodeBlock = (key: string): string | undefined =>
	formattedCodeBlocks.get(key);

const setFormattedCodeBlock = (key: string, value: string): void => {
	formattedCodeBlocks.set(key, value);
};

const clearFormattedCodeBlocks = (): void => {
	formattedCodeBlocks.clear();
};

const BLOCK_COMMENT_CLASS = 'apex.jorje.parser.impl.HiddenTokens$BlockComment';
const NOT_FOUND_INDEX = -1;
const ZERO = 0;
const ONE = 1;
const SINGLE_DECLARATION = 1;

const isCommentNode = createNodeClassGuard<ApexNode>(
	(cls) =>
		cls !== undefined &&
		(cls === BLOCK_COMMENT_CLASS ||
			cls.includes('BlockComment') ||
			cls.includes('InlineComment')),
);

const createWrappedPrinter = (originalPrinter: any): any => {
	const result = { ...originalPrinter };

	// Implement embed function for {@code} blocks in comments
	if (!originalPrinter.embed) {
		result.embed = (
			path: Readonly<AstPath<ApexNode>>,
			options: Readonly<ParserOptions>,
		) => {
			// Check if this is a comment node with {@code} blocks
			if (!isCommentNode(path.node)) {
				return null;
			}

			const commentNode = path.node as { value?: string };
			const commentText = commentNode.value;

			if (!commentText || !commentText.includes('{@code')) {
				return null;
			}

			// Return async function that processes {@code} blocks using prettier.format
			return async (
				_textToDoc: (
					text: string,
					options: ParserOptions,
				) => Promise<Doc>,
			): Promise<Doc | undefined> => {
				const codeTag = '{@code';
				let result = commentText;
				let startIndex = 0;
				let hasChanges = false;

				while (
					(startIndex = result.indexOf(codeTag, startIndex)) !== -1
				) {
					// Use extractCodeFromBlock for proper brace-counting extraction
					const extraction = extractCodeFromBlock(result, startIndex);
					if (!extraction) {
						startIndex += codeTag.length;
						continue;
					}

					const codeContent = extraction.code;

					try {
						// Format code using prettier.format to get a formatted string
						// Ensure our plugin is first in the plugins array so our wrapped printer is used
						const pluginInstance = getCurrentPluginInstance();
						const plugins = pluginInstance
							? [
									pluginInstance.default,
									...(options.plugins || []),
								]
							: options.plugins;

						// Calculate effective width: account for comment prefix
						// In class context, comments are typically indented by tabWidth (usually 2 spaces)
						// So the full prefix is "  * " (tabWidth + 3 for " * ")
						// For safety, we use a conservative estimate: tabWidth + 3
						const tabWidthValue = options.tabWidth || 2;
						const commentPrefixLength = tabWidthValue + 3; // base indent + " * " prefix
						const effectiveWidth =
							(options.printWidth || 80) - commentPrefixLength;

						let formattedCode;
						try {
							formattedCode = await prettier.format(codeContent, {
								...options,
								printWidth: effectiveWidth,
								parser: 'apex-anonymous',
								plugins,
							});
						} catch {
							try {
								formattedCode = await prettier.format(
									codeContent,
									{
										...options,
										printWidth: effectiveWidth,
										parser: 'apex',
										plugins,
									},
								);
							} catch {
								// When parsing fails, preserve the original code as-is
								formattedCode = codeContent;
							}
						}

						// Preserve blank lines: reinsert blank lines after } when followed by annotations or access modifiers
						// This preserves the structure from original code (blank lines after } before annotations/methods)
						const formattedLines = formattedCode.trim().split('\n');
						const resultLines: string[] = [];

						for (let i = 0; i < formattedLines.length; i++) {
							const formattedLine = formattedLines[i] ?? '';
							const trimmedLine = formattedLine.trim();
							resultLines.push(formattedLine);

							// Insert blank line after } when followed by annotations or access modifiers
							// This preserves the structure from original code
							if (
								trimmedLine.endsWith('}') &&
								i < formattedLines.length - 1
							) {
								const nextLineRaw = formattedLines[i + 1] ?? '';
								const nextLine = nextLineRaw.trim();
								// Check if next line starts with annotation or access modifier using AST-based detection
								if (
									nextLine.length > 0 &&
									(nextLine.startsWith('@') ||
										startsWithAccessModifier(nextLine))
								) {
									// Insert blank line - it will become ' *' when mapped with comment prefix
									resultLines.push('');
								}
							}
						}

						formattedCode = resultLines.join('\n');

						// Replace the code block with formatted version
						// Add comment prefix (* ) to each code line to preserve comment structure
						// beforeCode should include everything BEFORE {@code, not including {@code itself
						// This ensures we can properly replace {@code ... } with the formatted code block
						const beforeCode = result.substring(0, startIndex);
						const afterCode = result.substring(extraction.endPos);
						// Add * prefix to each formatted code line
						// Prettier normalizes comment indentation to a single space before *
						const formattedCodeLines = formattedCode
							.trim()
							.split('\n');
						const prefixedCodeLines = formattedCodeLines.map(
							(line) => (line ? ` * ${line}` : ' *'),
						);
						// Add {@code tag with * prefix and closing } tag with * prefix to match comment structure
						// Check if beforeCode already ends with a newline to avoid extra blank lines
						const needsLeadingNewline = !beforeCode.endsWith('\n');
						// For empty code blocks, output {@code} on a single line (no content between braces)
						const isEmptyBlock = codeContent.trim().length === 0;
						const newCodeBlock = isEmptyBlock
							? (needsLeadingNewline ? '\n' : '') +
								` * ${codeTag}}\n`
							: (needsLeadingNewline ? '\n' : '') +
								` * ${codeTag}\n` +
								prefixedCodeLines.join('\n') +
								'\n * }\n';
						result = beforeCode + newCodeBlock + afterCode;
						hasChanges = true;

						// Move past this code block
						startIndex = beforeCode.length + newCodeBlock.length;
					} catch (error) {
						// If formatting fails, skip this block
						console.warn(
							'Embed: Failed to format code block:',
							error,
						);
						startIndex = extraction.endPos;
					}
				}

				if (!hasChanges) {
					return undefined;
				}

				// Store formatted comment in cache for retrieval by processApexDocCommentLines
				const codeTagPos = commentText.indexOf('{@code');
				if (codeTagPos !== -1) {
					const commentKey = `${String(commentText.length)}-${String(codeTagPos)}`;
					setFormattedCodeBlock(commentKey, result);
				}

				// Return formatted comment as Doc (split into lines)
				const lines = result.split('\n');
				const { join, hardline } = doc.builders;
				return join(hardline, lines) as Doc;
			};
		};
	}

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
		if (
			nodeClass !== undefined &&
			nodeClass === 'apex.jorje.data.ast.VariableDecls'
		) {
			const { decls } = node as { decls?: unknown[] };
			// Check if any declaration has an assignment with a value using AST traversal
			// Even declarations without assignments have an assignment property (object), but it may not have a 'value' property
			let hasAssignments = false;
			if (Array.isArray(decls)) {
				// Use AST traversal instead of array.some() - check AST node properties directly
				for (const decl of decls) {
					if (decl && typeof decl === 'object') {
						const { assignment } = decl as { assignment?: unknown };
						// Check if assignment exists and has a 'value' property (real assignment)
						if (
							assignment !== null &&
							assignment !== undefined &&
							typeof assignment === 'object'
						) {
							const assignmentValue = (
								assignment as { value?: unknown }
							).value;
							if (
								assignmentValue !== null &&
								assignmentValue !== undefined
							) {
								hasAssignments = true;
								break;
							}
						}
					}
				}
			}

			/**
			 * Helper function to check if an assignment is a collection initialization.
			 * @param assignment - The assignment to check.
			 * @returns True if the assignment is a collection initialization.
			 */
			const isCollectionAssignment = (assignment: unknown): boolean => {
				if (!assignment || typeof assignment !== 'object') return false;
				const { value: assignmentValue } = assignment as {
					value?: unknown;
				};
				if (
					!assignmentValue ||
					typeof assignmentValue !== 'object' ||
					!('@class' in assignmentValue)
				)
					return false;
				const { '@class': assignmentValueClass } = assignmentValue as {
					'@class': unknown;
				};

				// Check if it's a NewExpr (which wraps collection literals)
				if (
					typeof assignmentValueClass === 'string' &&
					assignmentValueClass === 'apex.jorje.data.ast.Expr$NewExpr'
				) {
					// Check if the NewExpr contains a collection literal
					// The collection literal is in the 'creator' property
					const creator = (assignmentValue as { creator?: unknown })
						.creator;
					if (
						creator &&
						typeof creator === 'object' &&
						'@class' in creator
					) {
						const creatorClass = (creator as { '@class': unknown })[
							'@class'
						];
						return (
							typeof creatorClass === 'string' &&
							(creatorClass ===
								'apex.jorje.data.ast.NewObject$NewListLiteral' ||
								creatorClass ===
									'apex.jorje.data.ast.NewObject$NewSetLiteral' ||
								creatorClass ===
									'apex.jorje.data.ast.NewObject$NewMapLiteral')
						);
					}
				}
				return false;
			};

			if (hasAssignments && Array.isArray(decls)) {
				// Build the structure with proper grouping for wrapping
				// Structure: modifiers + type + [name + group([' =', indent([softline, assignment])])]
				const modifierDocs = path.map(
					print,
					'modifiers' as never,
				) as unknown as Doc[];
				const typeDoc = path.call(
					print,
					'type' as never,
				) as unknown as Doc;

				// Process each declaration with wrapping support
				const { join: joinDocs } = doc.builders;
				const declDocs = path.map(
					(declPath: Readonly<AstPath<ApexNode>>) => {
						const declNode = declPath.node;
						if (typeof declNode !== 'object' || declNode === null) {
							return print(declPath);
						}

						const assignment = (
							declNode as { assignment?: unknown }
						).assignment;
						if (assignment !== null && assignment !== undefined) {
							// Get name and assignment separately - use path.call(print, "assignment", "value") like original
							const nameDoc = declPath.call(
								print,
								'name' as never,
							) as unknown as Doc;
							// Use path.call with two arguments: "assignment", "value" to access nested property
							const assignmentDoc = declPath.call(
								print,
								'assignment' as never,
								'value' as never,
							) as unknown as Doc;

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
					},
					'decls' as never,
				) as unknown as Doc[];

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
						return (
							typeDocToCheck.startsWith('Map<') &&
							typeDocToCheck.includes('Map<')
						);
					}
					if (Array.isArray(typeDocToCheck)) {
						const firstElement = typeDocToCheck[ARRAY_START_INDEX];
						const isMap =
							firstElement === 'Map' ||
							(Array.isArray(firstElement) &&
								firstElement[ARRAY_START_INDEX] === 'Map');
						if (!isMap) return false;
						const TYPE_PARAMS_INDEX = 2;
						// Check if type parameters contain nested Map types (directly or deeply nested)
						if (
							typeDocToCheck.length > TYPE_PARAMS_INDEX &&
							Array.isArray(typeDocToCheck[TYPE_PARAMS_INDEX])
						) {
							const params = typeDocToCheck[
								TYPE_PARAMS_INDEX
							] as unknown[];
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
									if (
										Array.isArray(first) &&
										first[ARRAY_START_INDEX] === 'Map'
									)
										return true;
									// Recursively check nested structures for Map types
									return param.some((item) =>
										hasNestedMap(item),
									);
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
					} else if (
						declDocs.length === SINGLE_DECLARATION &&
						declDocs[ARRAY_START_INDEX] !== undefined
					) {
						// Single declaration: extract name and assignment to allow breaking at '='
						const declDoc = declDocs[ARRAY_START_INDEX] as Doc;
						const MIN_DECL_DOC_LENGTH = 5;
						const EQUALS_INDEX = 2;
						const ASSIGNMENT_INDEX = 4;
						// Check if declDoc is an array with the structure [name, ' ', '=', ' ', assignment]
						if (
							Array.isArray(declDoc) &&
							declDoc.length >= MIN_DECL_DOC_LENGTH &&
							declDoc[EQUALS_INDEX] === '='
						) {
							const nameDoc = declDoc[ARRAY_START_INDEX] as Doc;
							const assignmentDoc = declDoc[
								ASSIGNMENT_INDEX
							] as Doc;
							// Only apply ifBreak for complex Map types to allow breaking at '=' while keeping type together
							if (isComplexMapType(typeDoc)) {
								resultParts.push(' ');
								resultParts.push(group([nameDoc, ' ', '=']));
								const wrappedAssignment = ifBreak(
									indent([line, assignmentDoc]),
									[' ', assignmentDoc],
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
				const modifierDocs = path.map(
					print,
					'modifiers' as never,
				) as unknown as Doc[];
				const typeDoc = path.call(
					print,
					'type' as never,
				) as unknown as Doc;

				// Make typeDoc breakable by adding break points at commas
				const breakableTypeDoc = makeTypeDocBreakable(typeDoc, options);

				// Process each declaration - get name docs
				const { join: joinDocs } = doc.builders;
				const nameDocs = path.map(
					(declPath: Readonly<AstPath<ApexNode>>) => {
						const declNode = declPath.node;
						if (typeof declNode !== 'object' || declNode === null) {
							return undefined;
						}

						const nameDoc = declPath.call(
							print,
							'name' as never,
						) as unknown as Doc;
						return nameDoc;
					},
					'decls' as never,
				) as unknown as (Doc | undefined)[];

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
						const typeAndNames = nameDocs
							.filter(
								(nameDoc): nameDoc is Doc =>
									nameDoc !== undefined,
							)
							.map((nameDoc) => {
								const wrappedName = ifBreak(
									indent([line, nameDoc]),
									[' ', nameDoc],
								);
								return group([breakableTypeDoc, wrappedName]);
							});
						resultParts.push(
							joinDocs([', ', softline], typeAndNames),
						);
						resultParts.push(';');
						return group(resultParts);
					} else if (
						nameDocs.length === SINGLE_DECLARATION &&
						nameDocs[ARRAY_START_INDEX] !== undefined
					) {
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
						const wrappedName = ifBreak(indent([line, nameDoc]), [
							' ',
							nameDoc,
						]);
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
		if (
			nodeClass !== undefined &&
			nodeClass.includes('Stmnt$ExpressionStmnt')
		) {
			const expr = (node as { expr?: unknown }).expr;
			const exprNodeClass =
				expr && typeof expr === 'object' && '@class' in expr
					? getNodeClassOptional(expr as ApexNode)
					: undefined;
			const isAssignmentExpr =
				exprNodeClass !== undefined &&
				exprNodeClass.includes('Expr$AssignmentExpr');

			if (isAssignmentExpr && expr && typeof expr === 'object') {
				// Extract left-hand side (variable name) and right-hand side (assignment value)
				// AssignmentExpr structure: { left: ..., right: ... }
				const leftPath = path.call(
					print,
					'expr' as never,
					'left' as never,
				) as unknown as Doc;
				const rightPath = path.call(
					print,
					'expr' as never,
					'right' as never,
				) as unknown as Doc;
				const assignmentDoc = rightPath;

				if (leftPath && assignmentDoc) {
					// Apply H221 pattern: ifBreak(indent([line, assignmentDoc]), [' ', assignmentDoc])
					// Flat mode: [' ', assignmentDoc] - keeps on one line when fits
					// Break mode: indent([line, assignmentDoc]) - wraps with proper indent
					const wrappedAssignment = ifBreak(
						indent([line, assignmentDoc]),
						[' ', assignmentDoc],
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

	result.print = customPrint;

	return result;
};

/**
 * Process {@code} blocks in a comment asynchronously using Apex parser and printer.
 * @param commentValue - The comment text
 * @param options - Parser options
 * @returns Promise resolving to processed comment
 */
export {
	clearFormattedCodeBlocks,
	createWrappedPrinter,
	getCurrentOriginalText,
	getCurrentPrintOptions,
	getCurrentPluginInstance,
	getFormattedCodeBlock,
	setCurrentPluginInstance,
};
