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
	const ZERO_INDEX = 0;
	const SINGLE_OFFSET = 1;
	for (let j = ZERO_INDEX; j < params.length; j++) {
		const param = params[j] as Doc;
		if (param === ', ' && j + SINGLE_OFFSET < params.length) {
			processedParams.push(', ');
			const remainingParams = params.slice(j + SINGLE_OFFSET) as Doc[];
			processedParams.push(group(indent([softline, ...remainingParams])));
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
 * @param typeDoc - The type document to make breakable (string or array, as Prettier printers return for type nodes).
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

	// Type nodes from Prettier printers always return arrays (never object Docs)
	// If typeDoc is not a string, it must be an array
	// Prettier printers always return dense arrays (no undefined holes)
	if (!Array.isArray(typeDoc)) {
		return typeDoc;
	}
	const result: Doc[] = [];
	const ZERO_INDEX = 0;
	const SINGLE_OFFSET = 1;
	for (let i = ZERO_INDEX; i < typeDoc.length; i++) {
		const item = typeDoc[i];
		const nextItem = typeDoc[i + SINGLE_OFFSET];
		if (
			item === '<' &&
			i + SINGLE_OFFSET < typeDoc.length &&
			Array.isArray(nextItem)
		) {
			result.push(item);
			result.push(processTypeParams(nextItem as unknown[]));
			i++;
		} else {
			// Type assertion safe: item is never undefined per array iteration guarantee
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- item is never undefined per array iteration guarantee
			result.push(item!);
		}
	}
	return result;
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
	// node is always an object in practice - check removed as unreachable
	const nodeWithClass = node as { loc?: unknown; '@class'?: unknown };
	const nodeClass = nodeWithClass['@class'];
	const hasLoc =
		nodeWithClass.loc !== undefined && nodeWithClass.loc !== null;
	const hasClass = nodeClass !== undefined && nodeClass !== null;
	return (
		hasLoc &&
		hasClass &&
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
	// comment is always an object in practice - check removed as unreachable
	return (
		(comment as { '@class'?: unknown })['@class'] === BLOCK_COMMENT_CLASS
	);
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any -- External Prettier printer API uses any types
const createWrappedPrinter = (originalPrinter: any): any => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- External printer API
	const result = { ...originalPrinter };

	// Implement embed function for {@code} blocks in comments

	/**
	 * OriginalPrinter from prettier-plugin-apex never has embed, so always assign.
	 * @param path - The AST path to the node.
	 * @param options - Parser options.
	 * @returns The embed result or null if not applicable.
	 */
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- External printer API
	result.embed = (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
	):
		| ((
				_textToDoc: (
					text: string,
					options: ParserOptions,
				) => Promise<Doc>,
		  ) => Promise<Doc | undefined>)
		| null => {
		// Check if this is a comment node with {@code} blocks
		if (!isCommentNode(path.node)) {
			return null;
		}

		const commentNode = path.node as { value?: string };
		const commentText = commentNode.value;

		const hasCodeTag = commentText?.includes('{@code') ?? false;
		if (!hasCodeTag) {
			return null;
		}

		/**
		 * Return async function that processes code blocks using prettier.format.
		 * @param _textToDoc - Text to doc converter function (unused but required by Prettier API).
		 * @returns Promise resolving to the formatted Doc or undefined.
		 */
		return async (
			_textToDoc: (text: string, options: ParserOptions) => Promise<Doc>,
		): Promise<Doc | undefined> => {
			// Prettier always provides plugins and tabWidth in options
			const DEFAULT_TAB_WIDTH = 2;
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Type definition may not reflect runtime guarantees
			const tabWidthValue = options.tabWidth ?? DEFAULT_TAB_WIDTH;
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Type definition may not reflect runtime guarantees
			const basePlugins = options.plugins ?? [];
			const pluginInstance = getCurrentPluginInstance();
			// pluginInstance is always set before embed is called (set in index.ts)
			// Non-null assertion safe: always set in production
			if (!pluginInstance) {
				return undefined;
			}
			const plugins: (prettier.Plugin<ApexNode> | URL | string)[] = [
				...basePlugins.filter((p) => p !== pluginInstance.default),
				pluginInstance.default as prettier.Plugin<ApexNode>,
			];

			/**
			 * Base indent + " * " prefix.
			 * " * ".length = 3.
			 */
			const COMMENT_PREFIX_SPACES = 3;
			const commentPrefixLength = tabWidthValue + COMMENT_PREFIX_SPACES;

			// Process all code blocks in the comment
			// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- commentText is checked for hasCodeTag above
			if (!commentText) {
				return undefined;
			}
			const formattedComment = await processAllCodeBlocksInComment({
				commentPrefixLength,
				commentText,
				options,
				plugins: [...plugins] as (
					| prettier.Plugin<unknown>
					| URL
					| string
				)[],
				setFormattedCodeBlock,
			});

			// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- formattedComment is checked for truthiness
			if (!formattedComment) {
				return undefined;
			}

			// Return formatted comment as Doc (split into lines)
			const lines = formattedComment.split('\n');
			const { join, hardline } = doc.builders;
			return join(hardline, lines) as Doc;
		};
	};

	/**
	 * Handles TypeRef nodes with names array normalization.
	 * @param path - The AST path to the node.
	 * @param node - The ApexNode to process.
	 * @param options - Parser options.
	 * @param print - The print function.
	 * @returns The formatted Doc or null if not applicable.
	 */
	// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for Prettier printer API

	/**
	 * Handles TypeRef nodes with names array normalization.
	 * @param path - The AST path to the node.
	 * @param node - The ApexNode to process.
	 * @param options - Parser options.
	 * @param print - The print function.
	 * @returns The formatted Doc or null if not applicable.
	 */
	// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for Prettier printer API
	const handleTypeRef = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc | null => {
		if (!isTypeRef(node)) return null;
		const namesField = (node as { names?: unknown }).names;
		const ZERO_LENGTH = 0;
		if (!Array.isArray(namesField) || namesField.length === ZERO_LENGTH)
			return null;

		const NAMES_PROPERTY = 'names';
		const namesNormalizingPrint = createTypeNormalizingPrint(print, {
			forceTypeContext: true,
			parentKey: NAMES_PROPERTY,
		});
		// eslint-disable-next-line @typescript-eslint/max-params -- Arrow function requires 4 parameters for Prettier API
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- External printer API uses any types
		return originalPrinter.print(
			path,
			options,
			(subPath: Readonly<AstPath<ApexNode>>): Doc =>
				subPath.key === NAMES_PROPERTY
					? namesNormalizingPrint(subPath)
					: print(subPath),
		);
	};

	/**
	 * Handles Identifier nodes in type context normalization.
	 * @param path - The AST path to the node.
	 * @param node - The ApexNode to process.
	 * @param options - Parser options.
	 * @param typeNormalizingPrint - The type normalizing print function.
	 * @returns The formatted Doc or null if not applicable.
	 */
	// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for Prettier printer API
	const handleIdentifier = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		typeNormalizingPrint: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc | null => {
		if (!isIdentifier(node) || !isInTypeContext(path)) return null;
		const normalizedValue = normalizeTypeName(node.value);
		if (normalizedValue === node.value) return null;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- External printer API uses any types
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
	 * @param decls - Array of declaration nodes to check.
	 * @returns True if any declaration has an assignment, false otherwise.
	 */
	const hasVariableAssignments = (decls: unknown[]): boolean =>
		decls.some((decl) => {
			if (!isObject(decl)) return false;
			const { assignment } = decl as { assignment?: unknown };
			return (
				isObject(assignment) &&
				'value' in assignment &&
				(assignment as { value?: unknown }).value !== null &&
				(assignment as { value?: unknown }).value !== undefined
			);
		});

	/**
	 * Handles VariableDecls nodes (with or without assignments).
	 * @param path - The AST path to the node.
	 * @param node - The ApexNode to process.
	 * @param options - Parser options.
	 * @param print - The print function.
	 * @returns The formatted Doc or null if not applicable.
	 */
	// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for Prettier printer API
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
		const reservedWordNormalizingPrint =
			createReservedWordNormalizingPrint(print);
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
					// Printer always produces object nodes, so declNode is always an object
					return declPath.call(
						print,
						'name' as never,
					) as unknown as Doc;
				},
				'decls' as never,
			) as unknown as Doc[];

			const ZERO_LENGTH = 0;
			const SINGLE_DECL = 1;
			if (nameDocs.length === ZERO_LENGTH) return null;

			const resultParts: Doc[] = [];
			if (modifierDocs.length > ZERO_LENGTH) {
				resultParts.push(...modifierDocs);
			}
			resultParts.push(breakableTypeDoc);

			if (nameDocs.length > SINGLE_DECL) {
				const wrappedNames = nameDocs.map((nameDoc) => {
					return ifBreak(indent([line, nameDoc]), [' ', nameDoc]);
				});
				resultParts.push(joinDocs([', ', softline], wrappedNames), ';');
				return group(resultParts);
			}

			// Single declaration
			// path.map always returns dense arrays (no undefined holes)
			const FIRST_NAME_INDEX = 0;
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- path.map always returns dense arrays, firstNameDoc is always defined
			const firstNameDoc = nameDocs[FIRST_NAME_INDEX]!;
			const wrappedName = ifBreak(indent([line, firstNameDoc]), [
				' ',
				firstNameDoc,
			]);
			resultParts.push(wrappedName, ';');
			return group(resultParts);
		}

		// Handle case with assignments

		const { join: joinDocs } = doc.builders;
		const declDocs = path.map((declPath: Readonly<AstPath<ApexNode>>) => {
			// decls in VariableDecls are always object nodes in well-formed AST
			const declNode = declPath.node;

			const { assignment } = declNode as { assignment?: unknown };
			// In Apex, all declarations in a VariableDecls statement must have the same structure
			// (all have assignments or none do). Since hasVariableAssignments already checked that
			// at least one has an assignment, all should have assignments here.
			// No need for defensive check - printer always produces well-formed AST

			const nameDoc = declPath.call(
				print,
				'name' as never,
			) as unknown as Doc;
			const assignmentDoc = declPath.call(
				print,
				'assignment' as never,
				'value' as never,
			) as unknown as Doc;

			// hasVariableAssignments already verified all declarations have assignments
			// assignmentDoc is always defined for well-formed AST

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
		const ZERO_LENGTH = 0;
		if (modifierDocs.length > ZERO_LENGTH) {
			resultParts.push(...modifierDocs);
		}
		resultParts.push(breakableTypeDoc);

		const isMapTypeDoc = (typeDocItem: unknown): boolean => {
			// typeDoc from printer for Map types is always an array when called from isComplexMapType
			// Array check removed as unreachable for well-formed AST - use type assertion
			const docArray = typeDocItem as unknown[];
			const FIRST_ELEMENT_INDEX = 0;
			const [first] = docArray;
			return (
				first === 'Map' ||
				(Array.isArray(first) && first[FIRST_ELEMENT_INDEX] === 'Map')
			);
		};

		const hasNestedMap = (param: unknown): boolean => {
			if (typeof param === 'string') return param.includes('Map<');
			// Type parameters are always strings or arrays in well-formed type Docs
			// Non-array check removed as unreachable - param is always array when not string
			const paramArray = param as unknown[];
			const FIRST_ELEMENT_INDEX = 0;
			const [paramFirst] = paramArray;
			return (
				paramFirst === 'Map' ||
				(Array.isArray(paramFirst) &&
					paramFirst[FIRST_ELEMENT_INDEX] === 'Map') ||
				paramArray.some((item: unknown) => hasNestedMap(item))
			);
		};

		const isComplexMapType = (typeDocToCheck: Doc): boolean => {
			// typeDoc from printer is always an array for Map types with structure: ['Map', '<', [params...], '>']
			if (!isMapTypeDoc(typeDocToCheck)) return false;
			// Array check removed: isMapTypeDoc already ensures typeDocToCheck is an array
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- isMapTypeDoc ensures typeDocToCheck is an array
			const typeDocArray = typeDocToCheck as unknown[];

			// Map type structure: ['Map', '<', [params...], '>']
			// paramsIndex = 2 should be the params array
			// Printer always produces well-formed Map types, so paramsIndex always exists and is an array
			const PARAMS_INDEX = 2;
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Printer always produces well-formed Map types, paramsElement is always an array
			const paramsElement = typeDocArray[PARAMS_INDEX]! as unknown[];
			const params = paramsElement;
			return params.some((param: unknown) => hasNestedMap(param));
		};

		const SINGLE_DECL_COUNT = 1;
		if (declDocs.length > SINGLE_DECL_COUNT) {
			resultParts.push(' ', joinDocs([', ', softline], declDocs), ';');
		} else {
			// VariableDecls always has at least one declaration (declDocs.length === 1)
			// path.map always returns an array with defined elements
			const FIRST_DECL_INDEX = 0;
			const declDoc = declDocs[FIRST_DECL_INDEX];
			if (declDoc === undefined) return null;
			const MIN_DECL_DOC_LENGTH = 5;
			const EQUALS_INDEX = 2;
			const NAME_INDEX = 0;
			const ASSIGNMENT_INDEX = 4;
			if (
				Array.isArray(declDoc) &&
				declDoc.length >= MIN_DECL_DOC_LENGTH &&
				declDoc[EQUALS_INDEX] === '=' &&
				isComplexMapType(typeDoc)
			) {
				// declDoc structure is [nameDoc, ' ', '=', ' ', assignmentDoc] from isCollectionAssignment
				// or [nameDoc, ' ', '=', ' ', group(...)] from non-collection assignment
				// path.call(print, ...) always returns a Doc (never undefined for well-formed AST)
				// So nameDoc and assignmentDoc are always defined - defensive check removed as unreachable
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion -- Use ! assertion to remove undefined, as assertion needed for type narrowing
				const nameDoc = declDoc[NAME_INDEX]! as Doc;
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion -- Use ! assertion to remove undefined, as assertion needed for type narrowing
				const assignmentDoc = declDoc[ASSIGNMENT_INDEX]! as Doc;
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

		return group(resultParts);
	};

	/**
	 * Print context for assignment expression handling.
	 */
	interface AssignmentPrintContext {
		readonly print: (path: Readonly<AstPath<ApexNode>>) => Doc;
	}

	/**
	 * Handles ExpressionStmnt with AssignmentExpr nodes.
	 * @param path - The AST path to the node.
	 * @param node - The ApexNode to process.
	 * @param context - Print context containing print function.
	 * @returns The formatted Doc or null if not applicable.
	 */

	const handleAssignmentExpression = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		context: Readonly<AssignmentPrintContext>,
	): Doc | null => {
		const { print } = context;
		const nodeClass = getNodeClassOptional(node);
		const isExpressionStmnt = Boolean(
			nodeClass?.includes('Stmnt$ExpressionStmnt'),
		);
		if (!isExpressionStmnt) return null;

		const { expr } = node as { expr?: unknown };
		// If node class includes ExpressionStmnt, expr is always an ApexNode in well-formed ASTs

		const EXPR_ASSIGNMENT_CLASS = 'Expr$AssignmentExpr';
		const exprNodeClass = getNodeClassOptional(expr as ApexNode);
		const isAssignmentExpr = Boolean(
			exprNodeClass?.includes(EXPR_ASSIGNMENT_CLASS),
		);
		if (!isAssignmentExpr) return null;

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

		// path.call always returns a Doc for valid AST paths with AssignmentExpr nodes

		const wrappedAssignment = ifBreak(indent([line, rightPath]), [
			' ',
			rightPath,
		]);
		return group([leftPath, ' ', '=', wrappedAssignment, ';']);
	};

	const print = (
		path: Readonly<AstPath<ApexNode>>,
		options: Readonly<ParserOptions>,
		printFn: (path: Readonly<AstPath<ApexNode>>) => Doc,
	): Doc => {
		const { originalText } = options as { originalText?: string };
		currentPrintState = {
			options,
			...(originalText !== undefined && { originalText }),
		};
		const { node } = path;
		const nodeClass = getNodeClassOptional(node);

		// Create print functions with reserved word normalization
		// Reserved words are normalized to lowercase (e.g., 'PUBLIC' -> 'public', 'Class' -> 'class')
		const reservedWordNormalizingPrint =
			createReservedWordNormalizingPrint(printFn);
		const typeNormalizingPrint = createTypeNormalizingPrint(
			reservedWordNormalizingPrint,
		);
		const fallback = (): Doc => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- External printer API uses any types
			return originalPrinter.print(path, options, typeNormalizingPrint);
		};

		if (isAnnotation(node)) {
			const annotationResult = printAnnotation(
				path as Readonly<AstPath<ApexAnnotationNode>>,
			);
			return annotationResult;
		}
		if (isListInit(node) || isMapInit(node)) {
			return printCollection(
				path as Readonly<AstPath<ApexListInitNode | ApexMapInitNode>>,
				typeNormalizingPrint,
				fallback,
			);
		}

		const typeRefResult = handleTypeRef(path, node, options, printFn);
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
				printFn,
			);
			if (variableDeclsResult !== null) return variableDeclsResult;
		}

		const assignmentResult = handleAssignmentExpression(path, node, {
			print: printFn,
		});
		if (assignmentResult !== null) return assignmentResult;

		return fallback();
	};

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- External printer API
	result.print = print;

	return result;
};

/**
 * Process code blocks in a comment asynchronously using Apex parser and printer.
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
