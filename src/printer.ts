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
import {
	getNodeClassOptional,
	createNodeClassGuard,
	startsWithAccessModifier,
} from './utils.js';
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
 * Processes type parameters array to make first comma breakable.
 * @param params - The type parameters array.
 * @returns Processed parameters with breakable first comma.
 */
const processTypeParams = (params: unknown[]): Doc[] => {
	const processedParams: Doc[] = [];
	for (let j = 0; j < params.length; j++) {
		const param = params[j] as Doc;
		if (param === ', ' && j === processedParams.length) {
			processedParams.push(', ');
			if (j + 1 < params.length) {
				const remainingParams = params.slice(j + 1) as Doc[];
				processedParams.push(
					group(indent([softline, ...remainingParams])),
				);
				break;
			}
		} else {
			processedParams.push(param);
		}
	}
	return processedParams;
};

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
		const result: Doc[] = [];
		for (let i = 0; i < typeDoc.length; i++) {
			const item = typeDoc[i] as Doc;
			if (
				item === '<' &&
				i + 1 < typeDoc.length &&
				Array.isArray(typeDoc[i + 1])
			) {
				result.push(item);
				result.push(processTypeParams(typeDoc[i + 1] as unknown[]));
				i++;
			} else {
				result.push(item);
			}
		}
		return result;
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
const INLINE_COMMENT_CLASS =
	'apex.jorje.parser.impl.HiddenTokens$InlineComment';
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

/**
 * Checks if a comment can be attached to a node.
 * This is called by Prettier's comment handling code.
 * @param node - The node to check.
 * @returns True if a comment can be attached to this node.
 */
const canAttachComment = (node: unknown): boolean => {
	if (!node || typeof node !== 'object') return false;
	const nodeWithClass = node as { loc?: unknown; '@class'?: unknown };
	return (
		!!nodeWithClass.loc &&
		!!nodeWithClass['@class'] &&
		nodeWithClass['@class'] !== INLINE_COMMENT_CLASS &&
		nodeWithClass['@class'] !== BLOCK_COMMENT_CLASS
	);
};

/**
 * Checks if a comment is a block comment.
 * This is called by Prettier's comment handling code.
 * @param comment - The comment node to check.
 * @returns True if the comment is a block comment.
 */
const isBlockComment = (comment: unknown): boolean => {
	if (!comment || typeof comment !== 'object') return false;
	const commentWithClass = comment as { '@class'?: unknown };
	return commentWithClass['@class'] === BLOCK_COMMENT_CLASS;
};

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

	/**
	 * Handles TypeRef nodes with names array normalization.
	 */
	const handleTypeRef = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc | null => {
		if (!isTypeRef(node) || !('names' in node)) return null;
		const namesField = (node as { names?: unknown }).names;
		if (!Array.isArray(namesField) || namesField.length === 0) return null;

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
	};

	/**
	 * Handles Identifier nodes in type context normalization.
	 */
	const handleIdentifier = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		typeNormalizingPrint: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc | null => {
		if (!isIdentifier(node) || !isInTypeContext(path)) return null;
		const normalizedValue = normalizeTypeName(node.value);
		if (normalizedValue === node.value) return null;

		return originalPrinter.print(
			{ ...path, node: { ...node, value: normalizedValue } } as Readonly<
				AstPath<ApexNode>
			>,
			options,
			typeNormalizingPrint,
		);
	};

	/**
	 * Checks if VariableDecls has assignments using AST traversal.
	 */
	const hasVariableAssignments = (decls: unknown[]): boolean => {
		for (const decl of decls) {
			if (decl && typeof decl === 'object') {
				const assignment = (decl as { assignment?: unknown })
					.assignment;
				if (
					assignment !== null &&
					assignment !== undefined &&
					typeof assignment === 'object' &&
					'value' in assignment &&
					(assignment as { value?: unknown }).value !== null &&
					(assignment as { value?: unknown }).value !== undefined
				) {
					return true;
				}
			}
		}
		return false;
	};

	/**
	 * Handles VariableDecls nodes with assignments.
	 */
	const handleVariableDeclsWithAssignments = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc | null => {
		const { decls } = node as { decls?: unknown[] };
		if (!Array.isArray(decls) || !hasVariableAssignments(decls))
			return null;

		const modifierDocs = path.map(
			print,
			'modifiers' as never,
		) as unknown as Doc[];
		const typeDoc = path.call(print, 'type' as never) as unknown as Doc;
		const breakableTypeDoc = makeTypeDocBreakable(typeDoc, options);

		const isCollectionAssignment = (assignment: unknown): boolean => {
			if (
				!assignment ||
				typeof assignment !== 'object' ||
				!('value' in assignment)
			)
				return false;
			const value = (assignment as { value?: unknown }).value;
			if (!value || typeof value !== 'object' || !('@class' in value))
				return false;
			const valueClass = (value as { '@class': unknown })['@class'];
			if (
				typeof valueClass !== 'string' ||
				valueClass !== 'apex.jorje.data.ast.Expr$NewExpr'
			)
				return false;
			const creator = (value as { creator?: unknown }).creator;
			if (
				!creator ||
				typeof creator !== 'object' ||
				!('@class' in creator)
			)
				return false;
			const creatorClass = (creator as { '@class': unknown })['@class'];
			return (
				typeof creatorClass === 'string' &&
				(creatorClass ===
					'apex.jorje.data.ast.NewObject$NewListLiteral' ||
					creatorClass ===
						'apex.jorje.data.ast.NewObject$NewSetLiteral' ||
					creatorClass ===
						'apex.jorje.data.ast.NewObject$NewMapLiteral')
			);
		};

		const { join: joinDocs } = doc.builders;
		const declDocs = path.map((declPath: Readonly<AstPath<ApexNode>>) => {
			const declNode = declPath.node;
			if (typeof declNode !== 'object' || declNode === null)
				return print(declPath);

			const assignment = (declNode as { assignment?: unknown })
				.assignment;
			if (assignment === null || assignment === undefined)
				return print(declPath);

			const nameDoc = declPath.call(
				print,
				'name' as never,
			) as unknown as Doc;
			const assignmentDoc = declPath.call(
				print,
				'assignment' as never,
				'value' as never,
			) as unknown as Doc;

			if (!assignmentDoc) return print(declPath);

			if (isCollectionAssignment(assignment)) {
				return [nameDoc, ' ', '=', ' ', assignmentDoc];
			}
			return [
				nameDoc,
				' ',
				'=',
				' ',
				group(indent([softline, assignmentDoc])),
			];
		}, 'decls' as never) as unknown as Doc[];

		const resultParts: Doc[] = [];
		if (modifierDocs.length > 0) {
			resultParts.push(...modifierDocs);
		}
		resultParts.push(breakableTypeDoc);

		const isComplexMapType = (typeDocToCheck: Doc): boolean => {
			if (typeof typeDocToCheck === 'string') {
				return (
					typeDocToCheck.startsWith('Map<') &&
					typeDocToCheck.includes('Map<')
				);
			}
			if (Array.isArray(typeDocToCheck)) {
				const first = typeDocToCheck[ARRAY_START_INDEX];
				const isMap =
					first === 'Map' ||
					(Array.isArray(first) &&
						first[ARRAY_START_INDEX] === 'Map');
				if (!isMap) return false;
				if (
					typeDocToCheck.length > 2 &&
					Array.isArray(typeDocToCheck[2])
				) {
					const params = typeDocToCheck[2] as unknown[];
					const hasNestedMap = (param: unknown): boolean => {
						if (typeof param === 'string')
							return param.includes('Map<');
						if (Array.isArray(param)) {
							const first = param[ARRAY_START_INDEX];
							if (first === 'Map') return true;
							if (
								Array.isArray(first) &&
								first[ARRAY_START_INDEX] === 'Map'
							)
								return true;
							return param.some((item) => hasNestedMap(item));
						}
						return false;
					};
					return params.some((param) => hasNestedMap(param));
				}
			}
			return false;
		};

		if (declDocs.length > 1) {
			resultParts.push(' ', joinDocs([', ', softline], declDocs), ';');
		} else if (declDocs.length === 1 && declDocs[0] !== undefined) {
			const declDoc = declDocs[0] as Doc;
			if (
				Array.isArray(declDoc) &&
				declDoc.length >= 5 &&
				declDoc[2] === '='
			) {
				const nameDoc = declDoc[0] as Doc;
				const assignmentDoc = declDoc[4] as Doc;
				if (isComplexMapType(typeDoc)) {
					resultParts.push(' ', group([nameDoc, ' ', '=']));
					resultParts.push(
						ifBreak(indent([line, assignmentDoc]), [
							' ',
							assignmentDoc,
						]),
					);
					resultParts.push(';');
				} else {
					resultParts.push(' ', [declDoc, ';']);
				}
			} else {
				resultParts.push(' ', [declDoc, ';']);
			}
		}

		return group(resultParts);
	};

	/**
	 * Handles VariableDecls nodes without assignments.
	 */
	const handleVariableDeclsWithoutAssignments = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc | null => {
		const { decls } = node as { decls?: unknown[] };
		if (!Array.isArray(decls) || hasVariableAssignments(decls)) return null;

		const modifierDocs = path.map(
			print,
			'modifiers' as never,
		) as unknown as Doc[];
		const typeDoc = path.call(print, 'type' as never) as unknown as Doc;
		const breakableTypeDoc = makeTypeDocBreakable(typeDoc, options);
		const { join: joinDocs } = doc.builders;
		const nameDocs = path.map((declPath: Readonly<AstPath<ApexNode>>) => {
			const declNode = declPath.node;
			if (typeof declNode !== 'object' || declNode === null)
				return undefined;
			return declPath.call(print, 'name' as never) as unknown as Doc;
		}, 'decls' as never) as unknown as (Doc | undefined)[];

		if (nameDocs.length === 0) return null;

		const resultParts: Doc[] = [];
		if (modifierDocs.length > 0) {
			resultParts.push(...modifierDocs);
		}
		resultParts.push(breakableTypeDoc);

		if (nameDocs.length > 1) {
			const typeAndNames = nameDocs
				.filter((nameDoc): nameDoc is Doc => nameDoc !== undefined)
				.map((nameDoc) => {
					const wrappedName = ifBreak(indent([line, nameDoc]), [
						' ',
						nameDoc,
					]);
					return group([breakableTypeDoc, wrappedName]);
				});
			resultParts.push(joinDocs([', ', softline], typeAndNames), ';');
			return group(resultParts);
		}

		if (nameDocs[0] !== undefined) {
			const wrappedName = ifBreak(indent([line, nameDocs[0]]), [
				' ',
				nameDocs[0],
			]);
			resultParts.push(wrappedName, ';');
			return group(resultParts);
		}

		return null;
	};

	/**
	 * Handles ExpressionStmnt with AssignmentExpr nodes.
	 */
	const handleAssignmentExpression = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc | null => {
		const nodeClass = getNodeClassOptional(node);
		if (
			nodeClass === undefined ||
			!nodeClass.includes('Stmnt$ExpressionStmnt')
		)
			return null;

		const expr = (node as { expr?: unknown }).expr;
		if (!expr || typeof expr !== 'object' || !('@class' in expr))
			return null;

		const exprNodeClass = getNodeClassOptional(expr as ApexNode);
		if (
			exprNodeClass === undefined ||
			!exprNodeClass.includes('Expr$AssignmentExpr')
		)
			return null;

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

		if (!leftPath || !rightPath) return null;

		const wrappedAssignment = ifBreak(indent([line, rightPath]), [
			' ',
			rightPath,
		]);
		return group([leftPath, ' ', '=', wrappedAssignment, ';']);
	};

	const customPrint = (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc => {
		currentPrintOptions = options;
		currentOriginalText = (options as { originalText?: string })
			.originalText;
		const { node } = path;
		const nodeClass = getNodeClassOptional(node);
		const typeNormalizingPrint = createTypeNormalizingPrint(print);
		const fallback = (): Doc =>
			originalPrinter.print(path, options, typeNormalizingPrint);

		if (isAnnotation(node)) {
			return printAnnotation(
				path as Readonly<AstPath<ApexAnnotationNode>>,
			);
		}
		if (isListInit(node) || isMapInit(node)) {
			return printCollection(
				path as Readonly<AstPath<ApexListInitNode | ApexMapInitNode>>,
				typeNormalizingPrint,
				fallback,
			);
		}

		const typeRefResult = handleTypeRef(path, node, options, print);
		if (typeRefResult !== null) return typeRefResult;

		const identifierResult = handleIdentifier(
			path,
			node,
			options,
			typeNormalizingPrint,
		);
		if (identifierResult !== null) return identifierResult;

		if (nodeClass === 'apex.jorje.data.ast.VariableDecls') {
			const withAssignments = handleVariableDeclsWithAssignments(
				path,
				node,
				options,
				print,
			);
			if (withAssignments !== null) return withAssignments;

			const withoutAssignments = handleVariableDeclsWithoutAssignments(
				path,
				node,
				options,
				print,
			);
			if (withoutAssignments !== null) return withoutAssignments;
		}

		const assignmentResult = handleAssignmentExpression(
			path,
			node,
			options,
			print,
		);
		if (assignmentResult !== null) return assignmentResult;

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
	canAttachComment,
	clearFormattedCodeBlocks,
	createWrappedPrinter,
	getCurrentOriginalText,
	getCurrentPrintOptions,
	getCurrentPluginInstance,
	getFormattedCodeBlock,
	isBlockComment,
	setCurrentPluginInstance,
};
