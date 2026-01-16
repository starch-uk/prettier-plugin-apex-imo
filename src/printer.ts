/**
 * @file Creates a wrapped printer that extends the original prettier-plugin-apex printer with custom formatting for annotations, collections, and type references.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { doc } from 'prettier';
import type * as prettier from 'prettier';
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
	createReservedWordNormalizingPrint,
	isIdentifier,
	isInTypeContext,
	normalizeTypeName,
	TYPEREF_CLASS,
} from './casing.js';
import {
	isListInit,
	isMapInit,
	printCollection,
	isCollectionAssignment,
} from './collections.js';
import {
	getNodeClassOptional,
	createNodeClassGuard,
	isObject,
	isApexNodeLike,
} from './utils.js';
import { processAllCodeBlocksInComment } from './apexdoc-code.js';

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
		if (param === ', ' && j + 1 < params.length) {
			processedParams.push(', ');
			const remainingParams = params.slice(j + 1) as Doc[];
			processedParams.push(
				 
				group(indent([softline, ...remainingParams])),
			);
			break;
		}
		processedParams.push(param);
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
			const item = typeDoc[i]!;
			const nextItem = typeDoc[i + 1];
			if (
				item === '<' &&
				// eslint-disable-next-line @typescript-eslint/no-magic-numbers
				i + 1 < typeDoc.length &&
				Array.isArray(nextItem)
			) {
				result.push(item);
				result.push(processTypeParams(nextItem as unknown[]));
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
let currentPrintState: {
	options?: Readonly<ParserOptions>;
	originalText?: string | undefined;
} = {};

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
	currentPrintState.options;

const getCurrentOriginalText = (): string | undefined =>
	currentPrintState.originalText;

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
	if (!isObject(node)) return false;
	const nodeWithClass = node as { loc?: unknown; '@class'?: unknown };
	const nodeClass = nodeWithClass['@class'];
	return (
		!!nodeWithClass.loc &&
		!!nodeClass &&
		nodeClass !== INLINE_COMMENT_CLASS &&
		nodeClass !== BLOCK_COMMENT_CLASS
	);
};

/**
 * Checks if a comment is a block comment.
 * This is called by Prettier's comment handling code.
 * @param comment - The comment node to check.
 * @returns True if the comment is a block comment.
 */
const isBlockComment = (comment: unknown): boolean => {
	if (!isObject(comment)) return false;
	return (
		(comment as { '@class'?: unknown })['@class'] === BLOCK_COMMENT_CLASS
	);
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

			if (!commentText?.includes('{@code')) {
				return null;
			}

			/**
			 * Return async function that processes {@code} blocks using prettier.format.
			 * @param _textToDoc
			 */
			return async (
				_textToDoc: (
					text: string,
					options: ParserOptions,
				) => Promise<Doc>,
			): Promise<Doc | undefined> => {
				// Cache options values early
				if (
					options.plugins === undefined ||
					options.tabWidth === undefined
				) {
					throw new Error(
						'prettier-plugin-apex-imo: options.plugins and options.tabWidth are required',
					);
				}
				const tabWidthValue = options.tabWidth;
				const basePlugins = options.plugins;
				const pluginInstance = getCurrentPluginInstance();
				const plugins: (prettier.Plugin<ApexNode> | URL | string)[] =
					pluginInstance
						? [
								...basePlugins.filter(
									(p) => p !== pluginInstance.default,
								),
								pluginInstance.default as prettier.Plugin<ApexNode>,
							]
						: basePlugins;

				/**
				 * Base indent + " * " prefix.
				 */
			 const commentPrefixLength = tabWidthValue + 3; 

				// Process all code blocks in the comment
				const formattedComment = await processAllCodeBlocksInComment({
					commentPrefixLength,
					commentText,
					options,
					plugins: [...plugins] as (
						prettier.Plugin<unknown> | URL | string
					)[],
					setFormattedCodeBlock,
				});

				if (!formattedComment) {
					return undefined;
				}

				// Return formatted comment as Doc (split into lines)
				const lines = formattedComment.split('\n');
				const { join, hardline } = doc.builders;
				return join(hardline, lines) as Doc;
			};
		};
	}

	/**
	 * Handles TypeRef nodes with names array normalization.
	 * @param path
	 * @param node
	 * @param options
	 * @param print
	 */
	const handleTypeRef = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc | null => {
		if (!isTypeRef(node)) return null;
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
	 * @param path
	 * @param node
	 * @param options
	 * @param typeNormalizingPrint
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
	 * @param decls
	 */
	const hasVariableAssignments = (decls: unknown[]): boolean =>
		decls.some((decl) => {
			if (!isObject(decl)) return false;
			const {assignment} = (decl as { assignment?: unknown });
			return (
				isObject(assignment) &&
				'value' in assignment &&
				(assignment as { value?: unknown }).value !== null &&
				(assignment as { value?: unknown }).value !== undefined
			);
		});

	/**
	 * Handles VariableDecls nodes (with or without assignments).
	 * @param path
	 * @param node
	 * @param options
	 * @param print
	 */
	const handleVariableDecls = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc | null => {
		const { decls } = node as { decls?: unknown[] };
		if (!Array.isArray(decls)) return null;

		// Cache these values as they're used in both branches
		// Normalize reserved words in modifiers (e.g., PUBLIC -> public, Static -> static)
		const reservedWordNormalizingPrint = createReservedWordNormalizingPrint(print);
		const modifierDocs = path.map(
			reservedWordNormalizingPrint,
			'modifiers' as never,
		) as unknown as Doc[];
		const typeDoc = path.call(print, 'type' as never) as unknown as Doc;
		const breakableTypeDoc = makeTypeDocBreakable(typeDoc, options);
		const hasAssignments = hasVariableAssignments(decls);

		if (!hasAssignments) {
			// Handle case without assignments
			const { join: joinDocs } = doc.builders;
			const nameDocs = path.map(
				(declPath: Readonly<AstPath<ApexNode>>) => {
					const declNode = declPath.node;
					if (typeof declNode !== 'object' || declNode === null)
						return undefined;
					return declPath.call(
						print,
						'name' as never,
					) as unknown as Doc;
				},
				'decls' as never,
			) as unknown as (Doc | undefined)[];

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
		}

		// Handle case with assignments

		const { join: joinDocs } = doc.builders;
		const declDocs = path.map((declPath: Readonly<AstPath<ApexNode>>) => {
			const declNode = declPath.node;
			if (!isObject(declNode)) return print(declPath);

			const {assignment} = (declNode as { assignment?: unknown });
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

		const isMapTypeDoc = (doc: unknown): boolean => {
			if (typeof doc === 'string') return doc.includes('Map<');
			if (!Array.isArray(doc)) return false;
			// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- array index
			const first = doc[0];
			return (
				first === 'Map' ||
				(Array.isArray(first) &&
					// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- array index
					first[0] === 'Map')
			);
		};

		const hasNestedMap = (param: unknown): boolean => {
			if (typeof param === 'string') return param.includes('Map<');
			if (!Array.isArray(param)) return false;
			// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- array index
			const paramFirst = param[0];
			return (
				paramFirst === 'Map' ||
				(Array.isArray(paramFirst) &&
					// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- array index
					paramFirst[0] === 'Map') ||
				param.some((item) => hasNestedMap(item))
			);
		};

		const isComplexMapType = (typeDocToCheck: Doc): boolean => {
			if (typeof typeDocToCheck === 'string') {
				return typeDocToCheck.includes('Map<');
			}
			if (!Array.isArray(typeDocToCheck)) return false;
			if (!isMapTypeDoc(typeDocToCheck)) return false;
			 
			const paramsIndex = 2;
			if (
				typeDocToCheck.length <= paramsIndex ||
				!Array.isArray(typeDocToCheck[paramsIndex])
			) {
				return false;
			}
			 
			const params = typeDocToCheck[paramsIndex] as unknown[];
			return params.some((param) => hasNestedMap(param));
		};

		if (declDocs.length > 1) {
			resultParts.push(' ', joinDocs([', ', softline], declDocs), ';');
		} else if (declDocs.length === 1) {
			const declDoc = declDocs[0];
			if (declDoc !== undefined) {
				if (
					Array.isArray(declDoc) &&
					declDoc.length >= 5 &&
					declDoc[2] === '=' &&
					isComplexMapType(typeDoc)
				) {
					const nameDoc = declDoc[0]!;
					const assignmentDoc = declDoc[4]!;
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
			}
		}

		return group(resultParts);
	};

	/**
	 * Handles ExpressionStmnt with AssignmentExpr nodes.
	 * @param path
	 * @param node
	 * @param _options
	 * @param print
	 */
	const handleAssignmentExpression = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		_options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc | null => {
		const nodeClass = getNodeClassOptional(node);
		if (
			!nodeClass?.includes('Stmnt$ExpressionStmnt')
		)
			return null;

		const {expr} = (node as { expr?: unknown });
		if (!isApexNodeLike(expr)) return null;

		const EXPR_ASSIGNMENT_CLASS = 'Expr$AssignmentExpr';
		const exprNodeClass = getNodeClassOptional(expr as ApexNode);
		if (
			!exprNodeClass?.includes(EXPR_ASSIGNMENT_CLASS)
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

	const print = (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc => {
		const {originalText} = (options as { originalText?: string });
		currentPrintState = {
			options,
			...(originalText !== undefined && { originalText }),
		};
		const { node } = path;
		const nodeClass = getNodeClassOptional(node);
		
		// Create print functions with reserved word normalization
		// Reserved words are normalized to lowercase (e.g., 'PUBLIC' -> 'public', 'Class' -> 'class')
		const reservedWordNormalizingPrint = createReservedWordNormalizingPrint(print);
		const typeNormalizingPrint = createTypeNormalizingPrint(reservedWordNormalizingPrint);
		const fallback = (): Doc =>
			originalPrinter.print(path, options, typeNormalizingPrint);

		if (isAnnotation(node)) {
			const result = printAnnotation(
				path as Readonly<AstPath<ApexAnnotationNode>>,
			);
			return result;
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
			const variableDeclsResult = handleVariableDecls(
				path,
				node,
				options,
				print,
			);
			if (variableDeclsResult !== null) return variableDeclsResult;
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

	result.print = print;

	return result;
};

/**
 * Process {@code} blocks in a comment asynchronously using Apex parser and printer.
 * @param commentValue - The comment text.
 * @param options - Parser options.
 * @returns Promise resolving to processed comment.
 */
export {
	canAttachComment,
	createWrappedPrinter,
	getCurrentOriginalText,
	getCurrentPrintOptions,
	getFormattedCodeBlock,
	isBlockComment,
	setCurrentPluginInstance,
};
