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

const { group, indent, softline, ifBreak, line, join, hardline } = doc.builders;
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

const APEX_CLASS_DECL = 'apex.jorje.data.ast.ClassDecl';
const APEX_INTERFACE_DECL = 'apex.jorje.data.ast.InterfaceDecl';
const APEX_ENUM_DECL = 'apex.jorje.data.ast.EnumDecl';
const APEX_METHOD_DECL = 'apex.jorje.data.ast.MethodDecl';
const APEX_BLOCK_MEMBER_METHOD = 'apex.jorje.data.ast.BlockMember$MethodMember';
const APEX_BLOCK_STMNT = 'apex.jorje.data.ast.Stmnt$BlockStmnt';
const APEX_MODIFIER_ANNOTATION_CLASS =
	'apex.jorje.data.ast.Modifier$Annotation';

const ZERO_LENGTH = 0;

const NO_DOLLAR_INDEX = -1;

const FIELD_RANK_ACCESS = 0;
const FIELD_RANK_STATIC = 1;
const FIELD_RANK_FINAL = 2;
const FIELD_RANK_TRANSIENT = 3;
const FIELD_RANK_OTHER = 4;
const FIELD_RANK_UNSPECIFIED = 5;

const METHOD_RANK_ACCESS = 0;
const METHOD_RANK_STATIC = 1;
const METHOD_RANK_OVERRIDE = 2;
const METHOD_RANK_VIRTUAL = 3;
const METHOD_RANK_ABSTRACT = 4;
const METHOD_RANK_OTHER = 5;
const METHOD_RANK_UNSPECIFIED = 6;

const ANNOTATION_RANK = -1;
const STRING_START_INDEX = 0;

const getModifierKeyword = (modifier: unknown): string | undefined => {
	if (!isObject(modifier)) return undefined;
	const modifierClass = (modifier as { ['@class']?: unknown })['@class'];
	if (typeof modifierClass !== 'string') return undefined;
	const lastDollarIndex = modifierClass.lastIndexOf('$');
	if (lastDollarIndex === NO_DOLLAR_INDEX) return undefined;
	const SINGLE_OFFSET = 1;
	const keyword = modifierClass.slice(lastDollarIndex + SINGLE_OFFSET);
	let result = keyword.toLowerCase();
	// Jorje modifier node classes are like `Modifier$PublicModifier` or `Modifier$StaticModifier`.
	// Our ranking tables expect the bare keyword: `public`, `static`, etc.
	const MODIFIER_SUFFIX = 'modifier';
	if (result.endsWith(MODIFIER_SUFFIX)) {
		result = result.slice(STRING_START_INDEX, -MODIFIER_SUFFIX.length);
	}
	return result;
};

const ACCESS_MODIFIERS: readonly string[] = [
	'global',
	'public',
	'protected',
	'private',
] as const;

const getFieldModifierRank = (keyword: string | undefined): number => {
	let rank = FIELD_RANK_UNSPECIFIED;
	if (keyword !== undefined) {
		if (ACCESS_MODIFIERS.includes(keyword)) rank = FIELD_RANK_ACCESS;
		else if (keyword === 'static') rank = FIELD_RANK_STATIC;
		else if (keyword === 'final') rank = FIELD_RANK_FINAL;
		else if (keyword === 'transient') rank = FIELD_RANK_TRANSIENT;
		else rank = FIELD_RANK_OTHER;
	}
	return rank;
};

const getMethodModifierRank = (keyword: string | undefined): number => {
	let rank = METHOD_RANK_UNSPECIFIED;
	if (keyword !== undefined) {
		if (ACCESS_MODIFIERS.includes(keyword)) rank = METHOD_RANK_ACCESS;
		else if (keyword === 'static') rank = METHOD_RANK_STATIC;
		else if (keyword === 'override') rank = METHOD_RANK_OVERRIDE;
		else if (keyword === 'virtual') rank = METHOD_RANK_VIRTUAL;
		else if (keyword === 'abstract') rank = METHOD_RANK_ABSTRACT;
		else rank = METHOD_RANK_OTHER;
	}
	return rank;
};

interface ModifierEntry {
	readonly index: number;
	readonly rank: number;
}

const buildSortedModifierIndexOrder = (
	modifiers: readonly unknown[],
	getRank: (keyword: string | undefined) => number,
): number[] => {
	const entries: ModifierEntry[] = [];

	for (let index = 0; index < modifiers.length; index++) {
		const modifier = modifiers[index];
		if (!isObject(modifier)) {
			entries.push({ index, rank: getRank(undefined) });
			continue;
		}

		const modifierClass = (modifier as { ['@class']?: unknown })['@class'];
		if (modifierClass === APEX_MODIFIER_ANNOTATION_CLASS) {
			// Always keep annotations before all keyword modifiers while preserving order
			entries.push({ index, rank: ANNOTATION_RANK });
			continue;
		}

		const keyword = getModifierKeyword(modifier);
		const rank = getRank(keyword);
		entries.push({ index, rank });
	}

	const sorted = entries
		.slice()
		.sort((left, right) => {
			if (left.rank !== right.rank) return left.rank - right.rank;
			return left.index - right.index;
		})
		.map((entry) => entry.index);
	return sorted;
};

const getSortedFieldModifierIndexOrder = (
	modifiers: readonly unknown[],
): number[] => buildSortedModifierIndexOrder(modifiers, getFieldModifierRank);

const getSortedMethodModifierIndexOrder = (
	modifiers: readonly unknown[],
): number[] => buildSortedModifierIndexOrder(modifiers, getMethodModifierRank);

const hasAnyComments = (node: unknown): boolean => {
	const maybe = node as { comments?: unknown } | null | undefined;
	const comments = maybe?.comments;
	return Array.isArray(comments) && comments.length > ZERO_LENGTH;
};

const isEmptyBlockStmntNode = (node: unknown): boolean => {
	const unwrapped =
		isObject(node) && 'value' in node
			? (node as { value?: unknown }).value
			: node;
	const maybe = unwrapped as { ['@class']?: unknown; stmnts?: unknown };
	if (maybe['@class'] !== APEX_BLOCK_STMNT) return false;
	return !Array.isArray(maybe.stmnts) || maybe.stmnts.length === ZERO_LENGTH;
};

/**
 * Determines the blank line spacing doc to insert between consecutive methods.
 * If the next member doc already starts with a hardline (e.g., from annotations),
 * only one hardline is needed. Otherwise, two hardlines are needed to create a blank line.
 * @param nextDoc - The doc for the next member (current member being processed).
 * @returns The doc to push for spacing between methods.
 */
const getMethodSpacingDoc = (nextDoc: Doc): Doc => {
	const nextStartsWithHardline =
		Array.isArray(nextDoc) &&
		nextDoc.length > ZERO_LENGTH &&
		nextDoc[ZERO_LENGTH] === hardline;
	// If nextDoc already starts with hardline, only add one more hardline
	// Otherwise, add [hardline, hardline] to create a blank line
	return nextStartsWithHardline ? hardline : [hardline, hardline];
};

/**
 * Conditionally adds modifier docs to parts array if modifiers exist.
 * @param parts - The parts array to add modifiers to.
 * @param modifierDocs - The modifier docs array (may be empty).
 */
const addModifierDocsIfPresent = (
	parts: Doc[],
	modifierDocs: readonly Doc[],
): void => {
	if (modifierDocs.length > ZERO_LENGTH) {
		parts.push(modifierDocs as Doc);
	}
};

const blockSliceHasCommentMarkers = (
	blockNode: unknown,
	originalText: string | undefined,
): boolean => {
	if (typeof originalText !== 'string') return false;
	const unwrapped =
		isObject(blockNode) && 'value' in blockNode
			? (blockNode as { value?: unknown }).value
			: blockNode;
	const { loc } = unwrapped as {
		loc?: { startIndex?: number; endIndex?: number };
	};
	const startIndex =
		typeof loc?.startIndex === 'number' ? loc.startIndex : undefined;
	const endIndex =
		typeof loc?.endIndex === 'number' ? loc.endIndex : undefined;
	if (startIndex === undefined || endIndex === undefined) return false;
	const slice = originalText.slice(startIndex, endIndex);
	// Treat any inline or block comment markers as "has comments" for safety.
	return slice.includes('/*') || slice.includes('//');
};

/**
 * Extracts and formats typeArguments for classes.
 * Helper function to avoid code duplication between empty class path and spacing path.
 * @param node - The class node.
 * @param path - The AST path to the node.
 * @param print - The print function.
 * @returns Array of Docs for the typeArguments (e.g., ['<', 'T', ', ', 'U', '>']) or empty array.
 */
const formatTypeArguments = (
	node: ApexNode,
	path: Readonly<AstPath<ApexNode>>,
	print: (path: Readonly<AstPath<ApexNode>>) => Doc,
): Doc[] => {
	const typeArgs = (node as { typeArguments?: { value?: unknown[] } })
		.typeArguments?.value;
	if (Array.isArray(typeArgs) && typeArgs.length > ZERO_LENGTH) {
		const typeArgDocs = path.map(
			print,
			'typeArguments' as never,
			'value' as never,
		);
		return ['<', join(', ', typeArgDocs), '>'];
	}
	return [];
};

const buildEmptyClassInheritanceDocs = (
	path: Readonly<AstPath<ApexNode>>,
	typeNormalizingPrint: (path: Readonly<AstPath<ApexNode>>) => Doc,
): Doc[] => {
	const parts: Doc[] = [];

	const superClassDoc = path.call(
		typeNormalizingPrint,
		'superClass' as never,
		'value' as never,
	);
	// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- superClassDoc may be any Doc shape (string, array, object)
	if (superClassDoc) {
		parts.push(' ', 'extends', ' ', superClassDoc);
	}

	const interfaces = path.map(typeNormalizingPrint, 'interfaces' as never);
	if (interfaces.length > ZERO_LENGTH) {
		parts.push(' ', 'implements', ' ', join(', ', interfaces));
	}

	return parts;
};

// Internal helpers exported for unit testing and full coverage
const __TEST_ONLY__ = {
	addModifierDocsIfPresent,
	blockSliceHasCommentMarkers,
	buildEmptyClassInheritanceDocs,
	formatTypeArguments,
	getMethodModifierRank,
	getMethodSpacingDoc,
	getModifierKeyword,
	getSortedFieldModifierIndexOrder,
	getSortedMethodModifierIndexOrder,
	hasAnyComments,
	isEmptyBlockStmntNode,
};

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

		// Capture commentText for use in async function
		// This is logically guaranteed to be truthy if hasCodeTag is true,
		// but TypeScript requires the defensive check
		const capturedCommentText = commentText;

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
			// Ensure our plugin instance is LAST and not duplicated (Prettier may pass plugins as strings/paths).
			const plugins: (prettier.Plugin<ApexNode> | URL | string)[] = [
				...basePlugins,
				pluginInstance.default as prettier.Plugin<ApexNode>,
			];

			/**
			 * Base indent + " * " prefix.
			 * " * ".length = 3.
			 */
			const COMMENT_PREFIX_SPACES = 3;
			const commentPrefixLength = tabWidthValue + COMMENT_PREFIX_SPACES;

			// Process all code blocks in the comment
			// capturedCommentText is guaranteed to be truthy because hasCodeTag check above ensures
			// commentText?.includes('{@code') is truthy, which requires commentText to exist
			const formattedComment = await processAllCodeBlocksInComment({
				commentPrefixLength,
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- capturedCommentText is guaranteed to be truthy per hasCodeTag check
				commentText: capturedCommentText!,
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
			return join(line, lines) as Doc;
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

	/**
	 * Handles TypeRef nodes with names array normalization.
	 * @param path - The AST path to the node.
	 * @param node - The ApexNode to process.
	 * @param options - Parser options.
	 * @param print - The print function.
	 * @returns The formatted Doc or null if not applicable.
	 */
	const handleTypeRef = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
		// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for Prettier printer API
	): Doc | null => {
		if (!isTypeRef(node)) return null;
		const namesField = (node as { names?: unknown }).names;
		if (!Array.isArray(namesField) || namesField.length === ZERO_LENGTH)
			return null;

		const NAMES_PROPERTY = 'names';
		const namesNormalizingPrint = createTypeNormalizingPrint(print, {
			forceTypeContext: true,
			parentKey: NAMES_PROPERTY,
		});

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
	const handleIdentifier = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		typeNormalizingPrint: (path: Readonly<AstPath<ApexNode>>) => Doc,
		// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for Prettier printer API
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
	const handleVariableDecls = (
		path: Readonly<AstPath<ApexNode>>,
		node: ApexNode,
		options: Readonly<ParserOptions>,
		print: (path: Readonly<AstPath<ApexNode>>) => Doc,
		// eslint-disable-next-line @typescript-eslint/max-params -- Function requires 4 parameters for Prettier printer API
	): Doc | null => {
		const { decls } = node as {
			decls?: unknown[];
			modifiers?: unknown[];
		};
		if (!Array.isArray(decls)) return null;

		// Sort field modifiers in AST before printing (extract keywords from nodes, not Docs)
		// Mutate path.node.modifiers directly to ensure path.map() sees the sorted order
		const pathNodeModifiers = (path.node as { modifiers?: unknown[] })
			.modifiers;
		if (
			Array.isArray(pathNodeModifiers) &&
			pathNodeModifiers.length > ZERO_LENGTH
		) {
			const sortedModifierIndices =
				getSortedFieldModifierIndexOrder(pathNodeModifiers);
			const sortedModifiers = sortedModifierIndices.map(
				(index) => pathNodeModifiers[index],
			);
			// Mutate the modifiers array in place on path.node
			// This ensures path.map() will iterate in sorted order
			pathNodeModifiers.length = ZERO_LENGTH;
			for (const sortedModifier of sortedModifiers) {
				pathNodeModifiers.push(sortedModifier);
			}
		}
		const nodeModifiers = pathNodeModifiers;

		// Cache these values as they're used in both branches
		// Normalize reserved words in modifiers (e.g., PUBLIC -> public, Static -> static)
		const reservedWordNormalizingPrint =
			createReservedWordNormalizingPrint(print);
		// path.node.modifiers may be undefined, so handle that case
		const modifierDocs =
			Array.isArray(nodeModifiers) && nodeModifiers.length > ZERO_LENGTH
				? (path.map(
						reservedWordNormalizingPrint,
						'modifiers' as never,
					) as unknown as Doc[])
				: [];
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

			const SINGLE_DECL = 1;
			if (nameDocs.length === ZERO_LENGTH) return null;

			const resultParts: Doc[] = [];
			if (modifierDocs.length > ZERO_LENGTH) {
				resultParts.push(...modifierDocs);
			}

			if (nameDocs.length > SINGLE_DECL) {
				const wrappedNames = nameDocs.map((nameDoc) => {
					return ifBreak(indent([line, nameDoc]), [' ', nameDoc]);
				});
				// Keep wrapping decisions scoped to the `type names` group so that
				// unrelated line breaks (e.g., from annotations/modifiers) don't force a wrap.
				const signatureDoc = group([
					breakableTypeDoc,
					joinDocs([', ', softline], wrappedNames),
				]);
				resultParts.push(signatureDoc, ';');
				return group(resultParts);
			}

			// Single declaration: keep `type name;` on one line (fixtures expect no forced break here)
			// path.map always returns dense arrays (no undefined holes)
			const FIRST_NAME_INDEX = 0;
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- path.map always returns dense arrays, firstNameDoc is always defined
			const firstNameDoc = nameDocs[FIRST_NAME_INDEX]!;
			const wrappedName = ifBreak(indent([line, firstNameDoc]), [
				' ',
				firstNameDoc,
			]);
			const signatureDoc = group([breakableTypeDoc, wrappedName]);
			resultParts.push(signatureDoc, ';');
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

		// Inline empty class/interface/enum bodies as `{}` (upstream decl nodes are not BlockStmnt).
		if (
			nodeClass === APEX_CLASS_DECL ||
			nodeClass === APEX_INTERFACE_DECL ||
			nodeClass === APEX_ENUM_DECL
		) {
			const decl = node as unknown as { members?: unknown[] };
			const hasMembers =
				Array.isArray(decl.members) &&
				decl.members.length > ZERO_LENGTH;
			if (!hasMembers && !hasAnyComments(node)) {
				const parts: Doc[] = [];
				const modifierDocs = path.map(
					typeNormalizingPrint,
					'modifiers' as never,
				) as unknown as Doc[];
				if (modifierDocs.length > ZERO_LENGTH) parts.push(modifierDocs);

				parts.push(
					nodeClass === APEX_CLASS_DECL
						? 'class'
						: nodeClass === APEX_INTERFACE_DECL
							? 'interface'
							: 'enum',
				);
				parts.push(' ');
				parts.push(path.call(typeNormalizingPrint, 'name' as never));

				// Handle typeArguments using helper function (shared with spacing path)
				parts.push(
					...formatTypeArguments(node, path, typeNormalizingPrint),
				);

				if (nodeClass === APEX_CLASS_DECL) {
					parts.push(
						...buildEmptyClassInheritanceDocs(
							path,
							typeNormalizingPrint,
						),
					);
				}

				parts.push(' ', '{}');
				return parts;
			}

			// Handle classes with members: add spacing between consecutive methods
			// Only intercept if the class has at least one method AND spacing is needed
			// Skip spacing override for code blocks (apex-anonymous parser) to preserve original spacing
			const currentOptions = getCurrentPrintOptions();
			const isCodeBlockFormatting =
				currentOptions?.parser === 'apex-anonymous';
			if (
				hasMembers &&
				nodeClass === APEX_CLASS_DECL &&
				!isCodeBlockFormatting
			) {
				const hasAnyMethod = decl.members?.some((member) => {
					// Members from AST are always objects
					const memberClass = getNodeClassOptional(
						member as ApexNode,
					);
					return (
						memberClass === APEX_METHOD_DECL ||
						memberClass === APEX_BLOCK_MEMBER_METHOD
					);
				});
				// Check if original text has pattern indicating no spacing between methods
				// Pattern: method ending, newline, optional whitespace, annotation (no blank line)
				// Only add spacing if we have 3+ consecutive methods with this pattern
				const currentOriginalText = getCurrentOriginalText();
				let shouldAddSpacing = false;
				let maxConsecutiveMethodCount = 0;
				let matchCount = 0;
				if (hasAnyMethod === true) {
					// Count consecutive methods in AST (works even when originalText is unavailable,
					// e.g., during embedded {@code} formatting).
					// hasMembers check ensures members is an array with length > 0
					let currentConsecutiveCount = 0;
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- hasMembers check ensures members is array
					const members = decl.members!;
					for (const member of members) {
						// Members from AST are always objects
						const memberClass = getNodeClassOptional(
							member as ApexNode,
						);
						const isMethod =
							memberClass === APEX_BLOCK_MEMBER_METHOD ||
							memberClass === APEX_METHOD_DECL;
						if (isMethod) {
							currentConsecutiveCount++;
							if (
								currentConsecutiveCount >
								maxConsecutiveMethodCount
							) {
								maxConsecutiveMethodCount =
									currentConsecutiveCount;
							}
						} else {
							currentConsecutiveCount = ZERO_LENGTH;
						}
					}

					const METHOD_SPACING_CONSECUTIVE_THRESHOLD = 3;

					// Only apply spacing override when we have originalText to pattern-match.
					// Embedded formatting (e.g., {@code} blocks) should use upstream printer spacing.
					if (
						currentOriginalText !== undefined &&
						maxConsecutiveMethodCount >=
							METHOD_SPACING_CONSECUTIVE_THRESHOLD
					) {
						// Pattern for methods with annotations: }\n@
						const noSpacingPatternWithAnnotations = /\}\s*\n\s*@/g;
						// Pattern for methods without annotations: }\n\s*public|private|protected|global
						const noSpacingPatternWithoutAnnotations =
							/\}\s*\n\s*(public|private|protected|global)/g;
						const hasBlankLinePattern = /\}\s*\n\s*\n/;
						const matchesWithAnnotations =
							currentOriginalText.match(
								noSpacingPatternWithAnnotations,
							);
						const matchesWithoutAnnotations =
							currentOriginalText.match(
								noSpacingPatternWithoutAnnotations,
							);
						const ZERO_MATCHES = 0;
						const matchesWithAnnotationsCount =
							matchesWithAnnotations?.length ?? ZERO_MATCHES;
						const matchesWithoutAnnotationsCount =
							matchesWithoutAnnotations?.length ?? ZERO_MATCHES;
						// Use the higher count (methods with annotations might have more matches due to annotation lines)
						matchCount = Math.max(
							matchesWithAnnotationsCount,
							matchesWithoutAnnotationsCount,
						);
						// Require 2+ matches (indicating 3+ consecutive methods without spacing)
						// 2 matches means 3 consecutive methods: method1 -> method2 (match 1), method2 -> method3 (match 2)
						const MIN_MATCHES_FOR_SPACING = 2;
						// AND no blank lines between any methods
						shouldAddSpacing =
							matchCount >= MIN_MATCHES_FOR_SPACING &&
							!hasBlankLinePattern.test(currentOriginalText);
					}
				}
				if (shouldAddSpacing) {
					const memberDocs = path.map(
						typeNormalizingPrint,
						'members' as never,
					) as unknown as Doc[];
					// shouldAddSpacing is only true when we have 3+ consecutive methods, so memberDocs.length > 0
					const parts: Doc[] = [];
					const modifierDocs = path.map(
						typeNormalizingPrint,
						'modifiers' as never,
					) as unknown as Doc[];
					// modifierDocs is always an array, but may be empty if class has no modifiers
					addModifierDocsIfPresent(parts, modifierDocs);

					parts.push('class');
					parts.push(' ');
					parts.push(
						path.call(typeNormalizingPrint, 'name' as never),
					);

					// Handle typeArguments using helper function (shared with empty class path)
					parts.push(
						...formatTypeArguments(
							node,
							path,
							typeNormalizingPrint,
						),
					);

					parts.push(
						...buildEmptyClassInheritanceDocs(
							path,
							typeNormalizingPrint,
						),
					);

					// Add spacing between consecutive methods
					const formattedMembers: Doc[] = [];
					const INDEX_OFFSET = 1;
					// hasMembers check ensures members is an array
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- hasMembers ensures members is array
					const members = decl.members!;
					for (let i = 0; i < memberDocs.length; i++) {
						if (i > ZERO_LENGTH) {
							// memberDocs.length matches members.length, so indices are valid
							// Members from Jorje AST are always objects
							const prevMember = members[i - INDEX_OFFSET];
							const currentMember = members[i];
							const prevMemberClass = getNodeClassOptional(
								prevMember as ApexNode,
							);
							const currentMemberClass = getNodeClassOptional(
								currentMember as ApexNode,
							);
							const prevIsMethod =
								prevMemberClass === APEX_METHOD_DECL ||
								prevMemberClass === APEX_BLOCK_MEMBER_METHOD;
							const currentIsMethod =
								currentMemberClass === APEX_METHOD_DECL ||
								currentMemberClass === APEX_BLOCK_MEMBER_METHOD;
							// Add empty line between consecutive methods
							// Only add spacing if there are no comments between methods
							// Members from AST are always objects, but we check for safety
							const prevHasComments =
								isObject(prevMember) &&
								hasAnyComments(prevMember as ApexNode);
							const currentHasComments =
								isObject(currentMember) &&
								hasAnyComments(currentMember as ApexNode);
							// Only add blank lines between consecutive methods (not field↔method or method↔innerClass)
							const shouldInsertBlankLine =
								prevIsMethod &&
								currentIsMethod &&
								!prevHasComments &&
								!currentHasComments;

							if (shouldInsertBlankLine) {
								// Add exactly one blank line (two newlines). Some member docs (notably those
								// starting with annotations) already begin with a `hardline`, so we only
								// need one more newline in that case.
								// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Index is valid since we iterate over memberDocs
								const nextDoc = memberDocs[i]!;
								formattedMembers.push(
									getMethodSpacingDoc(nextDoc),
								);
							} else {
								// Normal spacing between members
								formattedMembers.push(softline);
							}
						}
						// path.map() always returns an array with the same length as members
						// so memberDoc is always defined
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Index is valid since we iterate over memberDocs
						const memberDoc = memberDocs[i]!;
						formattedMembers.push(memberDoc);
					}

					parts.push(
						' ',
						'{',
						indent([softline, ...formattedMembers]),
						softline,
						'}',
					);
					return group(parts);
				}
			}
		}

		// Inline empty method bodies as `{}` (stmnt is a wrapped BlockStmnt in practice).
		if (nodeClass === APEX_METHOD_DECL) {
			const method = node as unknown as {
				stmnt?: unknown;
				modifiers?: unknown[];
			};
			// Sort method modifiers in AST before printing
			if (!Array.isArray(method.modifiers)) {
				method.modifiers = [];
			}
			const methodModifiers = method.modifiers;
			if (methodModifiers.length > ZERO_LENGTH) {
				const sortedModifierIndices =
					getSortedMethodModifierIndexOrder(methodModifiers);
				const sortedModifiers = sortedModifierIndices.map(
					(index) => methodModifiers[index],
				);
				// methodModifiers is already verified as an array above, and it references method.modifiers
				// So method.modifiers is guaranteed to be an array here
				method.modifiers.length = ZERO_LENGTH;
				for (const sortedModifier of sortedModifiers) {
					method.modifiers.push(sortedModifier);
				}
			}

			const currentOriginalText = getCurrentOriginalText();
			const stmntHasCommentMarkers = blockSliceHasCommentMarkers(
				method.stmnt,
				currentOriginalText,
			);
			const hasEmptyBlock =
				method.stmnt !== undefined &&
				isEmptyBlockStmntNode(method.stmnt);
			const hasNodeComments = hasAnyComments(node);
			const hasBlockComments =
				method.stmnt !== undefined &&
				hasAnyComments(method.stmnt as ApexNode);
			if (
				hasEmptyBlock &&
				!hasNodeComments &&
				!hasBlockComments &&
				!stmntHasCommentMarkers
			) {
				const modifierDocs = path.map(
					typeNormalizingPrint,
					'modifiers' as never,
				);
				const parameterDocs = path.map(
					typeNormalizingPrint,
					'parameters' as never,
				);
				const parts: Doc[] = [];
				if (modifierDocs.length > ZERO_LENGTH) parts.push(modifierDocs);

				const typeDoc = path.call(
					typeNormalizingPrint,
					'type' as never,
					'value' as never,
				);
				// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- typeDoc may be falsy for void methods
				if (typeDoc) parts.push(typeDoc, ' ');
				parts.push(path.call(typeNormalizingPrint, 'name' as never));
				parts.push('(');
				if (parameterDocs.length > ZERO_LENGTH) {
					parts.push(
						group(
							indent([
								softline,
								join([',', line], parameterDocs),
								softline,
							]),
						),
					);
				}
				parts.push(')');
				parts.push(' ', '{}');
				return parts;
			}
		}

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
	__TEST_ONLY__,
	canAttachComment,
	createWrappedPrinter,
	getCurrentOriginalText,
	getCurrentPrintOptions,
	getFormattedCodeBlock,
	isBlockComment,
	setCurrentPluginInstance,
};
