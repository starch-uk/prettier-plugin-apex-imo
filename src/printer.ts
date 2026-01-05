/**
 * @file Creates a wrapped printer that extends the original prettier-plugin-apex printer with custom formatting for annotations, collections, and type references.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import * as prettier from 'prettier';
import { doc } from 'prettier';
import type { AstPath, Doc, ParserOptions, Plugin } from 'prettier';
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
import {
	getIndentLevel,
	createIndent,
	ARRAY_START_INDEX,
	DEFAULT_TAB_WIDTH,
} from './comments.js';
import { extractCodeFromBlock } from './apexdoc.js';

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
 */
const makeTypeDocBreakable = (typeDoc: Doc, options: Readonly<ParserOptions>): Doc => {
	if (typeof typeDoc === 'string') {
		return typeDoc;
	}
	if (Array.isArray(typeDoc)) {
		// Look for pattern: [baseType, '<', [params...], '>']
		const result: Doc[] = [];
		let i = 0;
		
		while (i < typeDoc.length) {
			const item = typeDoc[i] as Doc;
			
			// Check if we found '<' followed by an array (type parameters)
			if (item === '<' && i + 1 < typeDoc.length && Array.isArray(typeDoc[i + 1])) {
				result.push(item); // '<'
				i++;
				
				// Process the type parameters array
				const params = typeDoc[i] as unknown[];
				const processedParams: Doc[] = [];
				let firstCommaFound = false;
				
				for (let j = 0; j < params.length; j++) {
					const param = params[j] as Doc;
					if (param === ', ' && !firstCommaFound) {
						// First comma in type parameters - make it breakable
						// Structure: [param1, ', ', group([indent([softline, param2, ...])])]
						processedParams.push(', ');
						// Wrap remaining params in a group with indent and softline
						if (j + 1 < params.length) {
							const remainingParams = params.slice(j + 1);
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
	if (typeDoc && typeof typeDoc === 'object' && 'type' in typeDoc) {
		// It's a doc object (group, indent, etc.) - recurse into contents
		const docObj = typeDoc as { type: string; contents?: unknown; [key: string]: unknown };
		if ('contents' in docObj && docObj.contents !== undefined) {
			return {
				...docObj,
				contents: makeTypeDocBreakable(docObj.contents as Doc, options),
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
		// #region agent log - Node hierarchy investigation
		if (nodeClass !== undefined && (nodeClass.includes('FieldMember') || nodeClass.includes('VariableDecls') || nodeClass.includes('VariableDecl'))) {
			// Get parent context from path stack
			const stackDepth = path.stack?.length ?? 0;
			const pathKey = path.key;
			const parentInfo = stackDepth > 1 ? `parent at depth ${stackDepth - 1}` : 'no parent';
			fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{nodeClass,pathKey,stackDepth,parentInfo,nodeKeys:Object.keys(node).filter((k) => !k.startsWith('@')).slice(0,15)},hypothesisId:'NODE_HIERARCHY',location:'printer.ts:171',message:'Investigating node hierarchy for wrapping',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {
				// Ignore logging errors
			});
		}
		// Check specifically for VariableDecls to see its structure
		if (nodeClass !== undefined && nodeClass === 'apex.jorje.data.ast.VariableDecls') {
			const decls = (node as { decls?: unknown[] }).decls;
			const type = (node as { type?: unknown }).type;
			const modifiers = (node as { modifiers?: unknown[] }).modifiers;
			fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{nodeClass,pathKey:path.key,hasDecls:Array.isArray(decls),declsCount:Array.isArray(decls) ? decls.length : 0,hasType:!!type,hasModifiers:Array.isArray(modifiers),modifiersCount:Array.isArray(modifiers) ? modifiers.length : 0,firstDeclHasAssignment:Array.isArray(decls) && decls[0] && typeof decls[0] === 'object' && 'assignment' in decls[0] ? !!decls[0].assignment : false},hypothesisId:'VARIABLEDECLS_STRUCTURE',location:'printer.ts:185',message:'VariableDecls structure analysis',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {
				// Ignore logging errors
			});
		}
		// #endregion
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
		// #region agent log - Test H1: Check if ClassTypeRef has generics (types field)
		if (isTypeRef(node)) {
			const nodeClass = getNodeClassOptional(node);
			const hasTypes = 'types' in node;
			const typesField = hasTypes ? (node as { types?: unknown }).types : undefined;
			const typesIsArray = Array.isArray(typesField);
			const typesLength = typesIsArray ? typesField.length : 0;
			const hasNames = 'names' in node;
			fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{nodeClass,hasTypes,typesIsArray,typesLength,hasNames,isInVariableDecls:path.key === 'type' && path.stack.length > 10},hypothesisId:'H1',location:'printer.ts:207',message:'H1: Checking ClassTypeRef structure for generics',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {});
		}
		// #endregion
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
		// #region agent log - Test H2: Check if we should intercept ClassTypeRef with generics to add break points
		if (isTypeRef(node) && 'types' in node) {
			const typesField = (node as { types?: unknown }).types;
			const typesIsArray = Array.isArray(typesField);
			const typesLength = typesIsArray ? typesField.length : 0;
			const isInVariableDeclsType = path.key === 'type';
			// Check if parent is VariableDecls by checking stack
			const stackDepth = path.stack.length;
			const parentIsVariableDecls = stackDepth > 10; // VariableDecls is typically deeper in stack
			fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{typesIsArray,typesLength,isInVariableDeclsType,stackDepth,parentIsVariableDecls,shouldIntercept:typesIsArray && typesLength > 1 && isInVariableDeclsType},hypothesisId:'H2',location:'printer.ts:228',message:'H2: Should we intercept ClassTypeRef with generics?',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {});
		}
		// #endregion
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
		// Intercept VariableDecls nodes to enable wrapping for field declarations with assignments
		// This handles the full declaration including modifiers and type, so Prettier can evaluate full line length
		if (nodeClass !== undefined && nodeClass === 'apex.jorje.data.ast.VariableDecls') {
			const decls = (node as { decls?: unknown[] }).decls;
			const hasAssignments = Array.isArray(decls) && decls.some((decl) => decl && typeof decl === 'object' && 'assignment' in decl && decl.assignment !== null && decl.assignment !== undefined);
			
			if (hasAssignments && Array.isArray(decls)) {
				// Get the original Doc structure first to understand it
				const originalDoc = fallback();
				// #region agent log
				fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{hasAssignments,originalDocIsArray:Array.isArray(originalDoc),originalDocType:typeof originalDoc,declsCount:decls.length},hypothesisId:'ORIGINAL_DOC_STRUCTURE',location:'printer.ts:247',message:'Inspecting original Doc structure',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {
					// Ignore logging errors
				});
				// #endregion
				
				// Build the structure with proper grouping for wrapping
				// Structure: modifiers + type + [name + group([' =', indent([softline, assignment])])]
				const modifierDocs = path.map(print, 'modifiers' as never) as unknown as Doc[];
				const typeDoc = path.call(print, 'type' as never) as unknown as Doc;
				
				// Process each declaration with wrapping support
				const { join: joinDocs } = doc.builders;
				const declDocs = path.map((declPath: Readonly<AstPath<ApexNode>>) => {
					const declNode = declPath.node;
					if (!declNode || typeof declNode !== 'object') {
						return print(declPath);
					}
					
					// #region agent log - Inspect VariableDecl node structure
					const declNodeKeys = Object.keys(declNode).filter((k) => !k.startsWith('@')).slice(0,20);
					const hasAssignment = 'assignment' in declNode;
					fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{declNodeKeys,hasAssignment,declNodeType:typeof declNode,declNodeClass:(declNode as { '@class'?: unknown })['@class']},hypothesisId:'VARIABLEDECL_STRUCTURE',location:'printer.ts:263',message:'Inspecting VariableDecl node structure',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {
						// Ignore logging errors
					});
					// #endregion
					
					const assignment = (declNode as { assignment?: unknown }).assignment;
					if (assignment !== null && assignment !== undefined) {
						// Get name and assignment separately - use path.call(print, "assignment", "value") like original
						const nameDoc = declPath.call(print, 'name' as never) as unknown as Doc;
						// Use path.call with two arguments: "assignment", "value" to access nested property
						const assignmentDoc = declPath.call(print, 'assignment' as never, 'value' as never) as unknown as Doc;
						
						// #region agent log
						const assignmentNodeClass = assignment && typeof assignment === 'object' && '@class' in assignment ? (assignment as { '@class'?: unknown })['@class'] : 'unknown';
						fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{assignmentNodeClass,hasNameDoc:!!nameDoc,nameDocValue:typeof nameDoc === 'string' ? nameDoc.slice(0,50) : 'N/A',hasAssignmentDoc:!!assignmentDoc,assignmentDocType:typeof assignmentDoc,assignmentDocIsArray:Array.isArray(assignmentDoc),assignmentDocLength:typeof assignmentDoc === 'string' ? assignmentDoc.length : Array.isArray(assignmentDoc) ? assignmentDoc.length : 'N/A',assignmentDocPreview:typeof assignmentDoc === 'string' ? assignmentDoc.slice(0,100) : Array.isArray(assignmentDoc) ? 'Array[' + assignmentDoc.length + ']' : 'N/A'},hypothesisId:'VARIABLEDECL_IN_VARIABLEDECLS',location:'printer.ts:268',message:'Getting assignment in VariableDecls map with two-arg call',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {
							// Ignore logging errors
						});
						// #endregion
						
						// If assignmentDoc exists, create breakable structure
						if (assignmentDoc) {
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
				// #region agent log - Test H3: Inspect typeDoc structure for break points
				const typeDocType = typeof typeDoc;
				const typeDocIsArray = Array.isArray(typeDoc);
				const typeDocLength = typeDocIsArray ? (typeDoc as unknown[]).length : (typeof typeDoc === 'string' ? typeDoc.length : 'N/A');
				// Check if typeDoc has break points (softline, line, or group structures)
				const typeDocStr = JSON.stringify(typeDoc);
				const hasSoftline = typeDocStr.includes('"soft":true') || typeDocStr.includes('softline');
				const hasLine = typeDocStr.includes('"type":"line"');
				const hasGroup = typeDocStr.includes('"type":"group"');
				const hasComma = typeDocStr.includes(',');
				const typeDocPreview = typeof typeDoc === 'string' ? typeDoc.slice(0, 200) : typeDocIsArray ? JSON.stringify(typeDoc).slice(0, 200) : String(typeDoc).slice(0, 200);
				fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{typeDocType,typeDocIsArray,typeDocLength,hasSoftline,hasLine,hasGroup,hasComma,typeDocPreview,modifierDocsLength:modifierDocs.length,declDocsLength:declDocs.length},hypothesisId:'H3',location:'printer.ts:317',message:'H3: Inspecting typeDoc for break points at commas',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {});
				// #endregion
				// #region agent log - Inspect typeDoc structure before making breakable
				const typeDocStrBefore = JSON.stringify(typeDoc);
				const typeDocIsArrayBefore = Array.isArray(typeDoc);
				const typeDocLengthBefore = typeDocIsArrayBefore ? (typeDoc as unknown[]).length : 'N/A';
				fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{typeDocIsArrayBefore,typeDocLengthBefore,typeDocStructure:typeDocStrBefore.slice(0,500)},hypothesisId:'FIX_STRUCTURE',location:'printer.ts:353',message:'FIX: Inspecting typeDoc structure before processing',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {});
				// #endregion
				// Make typeDoc breakable by adding break points at commas
				const breakableTypeDoc = makeTypeDocBreakable(typeDoc, options);
				// #region agent log - Test fix: Check if breakableTypeDoc has break points
				const breakableTypeDocStr = JSON.stringify(breakableTypeDoc);
				const breakableHasSoftline = breakableTypeDocStr.includes('"soft":true') || breakableTypeDocStr.includes('softline');
				fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{breakableHasSoftline,breakableTypeDocPreview:breakableTypeDocStr.slice(0,500)},hypothesisId:'FIX',location:'printer.ts:360',message:'FIX: After making typeDoc breakable',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {});
				// #endregion
				resultParts.push(breakableTypeDoc);
				if (declDocs.length > 0) {
					resultParts.push(' ');
					if (declDocs.length > 1) {
						resultParts.push(joinDocs([', ', softline], declDocs));
						resultParts.push(';');
					} else if (declDocs.length === 1 && declDocs[0] !== undefined) {
						// Single declaration - add semicolon like original prettier-plugin-apex
						resultParts.push([declDocs[0] as Doc, ';']);
					}
				}
				// #region agent log - Inspect resultParts before grouping
				const resultPartsLength = resultParts.length;
				const resultPartsPreview = JSON.stringify(resultParts.slice(0, 5)).slice(0, 200);
				fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{resultPartsLength,resultPartsPreview,printWidth:options.printWidth},hypothesisId:'B',location:'printer.ts:329',message:'Inspecting resultParts before group wrapping',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {});
				// #endregion
				// Wrap in a group to allow breaking when full line exceeds printWidth
				const result = group(resultParts);
				
				// #region agent log
				fetch('http://127.0.0.1:7243/ingest/5117e7fc-4948-4144-ad32-789429ba513d',{body:JSON.stringify({data:{builtCustomDoc:true,declDocsCount:declDocs.length,resultLength:result.length},hypothesisId:'CUSTOM_DOC_BUILT',location:'printer.ts:331',message:'Built custom Doc with wrapping groups',runId:'initial',sessionId:'debug-session',timestamp:Date.now()}),headers:{'Content-Type':'application/json'},method:'POST'}).catch(() => {
					// Ignore logging errors
				});
				// #endregion
				
				return result;
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

						// Format the code using textToDoc (proper Prettier API)
						try {
							// Wrap code in a class context to ensure proper formatting
							// This ensures lists/maps are formatted multiline as expected
							const isAnnotationCode =
								typeof code === 'string' &&
								code.trim().startsWith('@');
							const wrappedCode = isAnnotationCode
								? `public class Temp { ${code} void method() {} }`
								: `public class Temp { void method() { ${code} } }`;

							// Use prettier.format with our plugin to ensure:
							// 1. Wrapped printer is used (for multiline lists/maps)
							// 2. Type normalization is applied (Account, Contact, etc.)
							// Import plugin dynamically if not set to avoid circular dependency
							let pluginToUse: Plugin<ApexNode> | undefined =
								undefined;
							// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- currentPluginInstance?.default can be any type
							if (currentPluginInstance?.default) {
								pluginToUse =
									currentPluginInstance.default as Plugin<ApexNode>;
							} else {
								// Fallback: import plugin dynamically
								// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Dynamic import types
								const pluginModule =
									// @ts-expect-error TS2307 -- Dynamic import path resolution at runtime
									await import('../index.js');
								// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Dynamic import types
								pluginToUse = pluginModule.default;
							}
							// CRITICAL: Ensure we're using the plugin with wrapped printer
							// The plugin should have our wrapped printer with type normalization
							// Verify the printer has our custom print function

							// eslint-disable-next-line @typescript-eslint/dot-notation -- TypeScript requires bracket notation for index signatures
							const apexPrinter = pluginToUse?.['printers']?.[
								'apex'
							] as
								| { print?: unknown; embed?: unknown }
								| undefined;
							if (
								!apexPrinter ||
								typeof apexPrinter.print !== 'function'
							) {
								// Fallback: if plugin doesn't have our wrapped printer, import it fresh
								// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Dynamic import types
								const pluginModule =
									// @ts-expect-error TS2307 -- Dynamic import path resolution at runtime
									await import('../index.js');
								// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Dynamic import types
								pluginToUse = pluginModule.default;
							}
							// CRITICAL: Use prettier.format with our plugin instance
							// This ensures our wrapped printer with type normalization is used
							// The wrapped printer's print function uses createTypeNormalizingPrint
							// which normalizes standard object types like "account" -> "Account"
							// The plugin instance should have our wrapped printer set up in index.ts

							const formattedWrapped = await prettier.format(
								wrappedCode,
								// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Prettier format options are complex
								{
									...options,
									parser: 'apex',
									plugins: [pluginToUse],
								},
							);

							// Extract the actual code from the wrapped format
							// Remove the wrapper class and extract just the code block
							const formattedWrappedTrimmed =
								formattedWrapped.trim();

							// eslint-disable-next-line @typescript-eslint/init-declarations -- formattedCode is assigned in all code paths
							let formattedCode: string;
							if (isAnnotationCode) {
								// Extract code between class declaration and method using line-by-line approach
								// This matches the logic in extractAnnotationCode from apexdoc.ts
								const lines =
									formattedWrappedTrimmed.split('\n');
								const codeLines: string[] = [];
								let classIndent = ZERO;
								let braceCount = ZERO;
								let inCode = false;
								// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Prettier options types
								const tabWidthRaw = options.tabWidth;
								// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- tabWidthRaw is any type from options
								const tabWidth =
									tabWidthRaw ?? DEFAULT_TAB_WIDTH;
								// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- tabWidth is number after ?? operator
								const indentOffset = tabWidth;
								const MIN_INDENT_LEVEL = ZERO;
								const INITIAL_BRACE_COUNT = ONE;

								for (const line of lines) {
									if (line.includes('public class Temp')) {
										classIndent = getIndentLevel(
											line,
											tabWidth as number,
										);
										braceCount = INITIAL_BRACE_COUNT;
										inCode = true;
										continue;
									}
									if (line.includes('void method()')) break;
									if (inCode) {
										const openBraces = (
											line.match(/\{/g) ?? []
										).length;
										const closeBraces = (
											line.match(/\}/g) ?? []
										).length;
										braceCount += openBraces - closeBraces;
										if (
											braceCount === ZERO &&
											line.trim() === '}'
										)
											break;
										const lineIndent = getIndentLevel(
											line,
											tabWidth as number,
										);
										const relativeIndent = Math.max(
											MIN_INDENT_LEVEL,
											lineIndent -
												classIndent -
												indentOffset,
										);

										codeLines.push(
											createIndent(
												relativeIndent,

												tabWidth as number,
												// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access -- Prettier options types
												options.useTabs,
											) + line.trimStart(),
										);
									}
								}
								formattedCode =
									codeLines.length > ZERO
										? codeLines.join('\n')
										: code;
							} else {
								// Extract code between method declaration and closing brace
								// Pattern: "void method() { CODE }"
								// Need to match the method's closing brace, not inner braces
								// Use brace counting to find the correct closing brace
								const methodStart =
									formattedWrappedTrimmed.indexOf(
										'void method() {',
									);
								if (methodStart !== NOT_FOUND_INDEX) {
									let braceCount = ONE;
									let pos =
										methodStart + 'void method() {'.length;
									let codeStart = pos;
									while (
										pos < formattedWrappedTrimmed.length &&
										braceCount > ZERO
									) {
										if (
											formattedWrappedTrimmed[pos] === '{'
										)
											braceCount++;
										else if (
											formattedWrappedTrimmed[pos] === '}'
										)
											braceCount--;
										pos++;
									}
									if (braceCount === ZERO) {
										// Found the matching closing brace
										const extractedCode =
											formattedWrappedTrimmed.substring(
												codeStart,
												pos - ONE,
											);
										// Preserve indentation structure - only trim leading/trailing newlines and whitespace
										// from the entire block, but preserve relative indentation within the code
										// This allows the stack to track: baseIndent + ' * ' + codeIndent
										// Don't trimEnd() as it removes trailing whitespace from all lines
										// Instead, only remove trailing newlines and trim the entire block
										formattedCode = extractedCode
											.replace(/^\n+/, '') // Remove leading newlines
											.replace(/\n+$/, '') // Remove trailing newlines
											.trimEnd(); // Remove trailing whitespace from last line only
									} else {
										formattedCode = code;
									}
								} else {
									formattedCode = code;
								}
							}

							codeBlockReplacements.push({
								end: endPos,
								formatted: formattedCode,
								start: tagPos,
							});
						} catch {
							// If formatting fails, skip this code block
						}

						searchPos = endPos;
					}

					// Store formatted code blocks for use in printComment
					// Apply replacements in reverse order to maintain positions
					if (codeBlockReplacements.length > ZERO) {
						let finalComment = commentValue;
						// Determine the base indentation and comment prefix separately
						// Stack structure: baseIndent + ' * ' + codeIndent + content
						// Look for the first line with ` * ` to determine the base indentation
						const firstLineMatch = /^(\s*)(\*)\s/m.exec(
							commentValue,
						);
						// Extract base indentation (spaces before asterisk) and comment prefix
						const FIRST_MATCH_GROUP = 1;
						const baseIndent =
							firstLineMatch?.[FIRST_MATCH_GROUP] ?? '';
						const commentPrefix = `${baseIndent} * `;
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
								// For annotation code (starts with @), always format as multiline
								// eslint-disable-next-line @typescript-eslint/init-declarations -- formattedWithPrefix is assigned in all code paths
								let formattedWithPrefix: string;
								// Only use multiline formatting if the code actually contains newlines
								// Single-line annotation code blocks should stay on one line
								if (replacement.formatted.includes('\n')) {
									// Always split by newlines to preserve multiline structure
									// For annotation code blocks, we want each line on its own line
									const lines =
										replacement.formatted.split('\n');
									// Find minimum indentation to normalize relative indentation
									// This represents the base indentation level from the formatted code
									const nonEmptyLines = lines.filter(
										(line) => line.trim().length > ZERO,
									);
									const EMPTY_LINE_COUNT = ZERO;
									const minIndent =
										nonEmptyLines.length > EMPTY_LINE_COUNT
											? Math.min(
													...nonEmptyLines.map(
														(line) => {
															const match =
																/^(\s*)/.exec(
																	line,
																);
															const MATCH_GROUP_INDEX =
																ONE;
															if (
																match === null
															) {
																return ZERO;
															}

															return (
																match[
																	MATCH_GROUP_INDEX
																]?.length ??
																ZERO
															);
														},
													),
												)
											: ZERO;
									// Use stack to track indentation: baseIndent + ' * ' + codeIndent
									// The stack preserves all three levels of indentation:
									// 1. Base indentation (from comment context - already in commentPrefix)
									// 2. Comment prefix (' * ' - already in commentPrefix)
									// 3. Code's own indentation (relative to minIndent - preserved here)
									// Track opening brace absolute indentation to match closing braces
									// Store the absolute whitespaceLength (not codeIndent) so closing braces
									// can match the exact indentation of their opening braces
									// This preserves Prettier's behavior where closing braces align with opening braces
									const openingBraceIndents: number[] = [];
									const prefixedLines = lines.map((line) => {
										if (line.trim().length === ZERO) {
											return commentPrefix.trimEnd();
										}
										// Get leading whitespace from the line
										const leadingWhitespaceMatch =
											/^(\s*)/.exec(line);
										const WHITESPACE_GROUP_INDEX = ONE;
										const leadingWhitespace =
											leadingWhitespaceMatch?.[
												WHITESPACE_GROUP_INDEX
											] ?? '';
										const whitespaceLength =
											leadingWhitespace.length;
										const trimmedLine = line.trim();
										// Calculate relative indentation beyond the minimum
										// This is the code's own indentation that should be preserved
										// Stack structure: baseIndent + ' * ' + codeIndent + content
										let codeIndent = Math.max(
											ZERO,
											whitespaceLength - minIndent,
										);
										// Track opening braces - push their absolute whitespaceLength
										// This allows closing braces to match the exact indentation of opening braces
										// The opening brace's indentation is the indentation of the line it's on
										// (even if the brace is at the end of the line, the line's indentation is what matters)
										const openBraces = (
											trimmedLine.match(/\{/g) ?? []
										).length;
										for (
											let braceIndex = ZERO;
											braceIndex < openBraces;
											braceIndex++
										) {
											openingBraceIndents.push(
												whitespaceLength,
											);
										}
										// For closing braces, match the absolute indentation of their opening brace
										// Handle both standalone '}' and lines like '};' or '},'
										const closeBraces = (
											trimmedLine.match(/\}/g) ?? []
										).length;
										if (
											closeBraces > ZERO &&
											openingBraceIndents.length > ZERO
										) {
											// Pop for each closing brace, and use the opening brace's absolute indentation
											// Calculate codeIndent from the opening brace's absolute indentation
											let matchingOpenIndent =
												whitespaceLength;
											for (
												let braceIndex = ZERO;
												braceIndex < closeBraces &&
												openingBraceIndents.length >
													ZERO;
												braceIndex++
											) {
												matchingOpenIndent =
													openingBraceIndents.pop() ??
													matchingOpenIndent;
											}
											// Calculate codeIndent relative to minIndent, matching the opening brace
											codeIndent = Math.max(
												ZERO,
												matchingOpenIndent - minIndent,
											);
										}
										// Strip the minimum indentation and all remaining leading whitespace
										// Then add back only the relative indentation (codeIndent)
										// This ensures we don't double-count indentation
										const contentAfterMinIndent =
											minIndent > ZERO
												? line.substring(minIndent)
												: line;
										const content =
											contentAfterMinIndent.trimStart();
										// Build the result using the stack structure:
										// commentPrefix (baseIndent + ' * ') + codeIndent + content
										const codeIndentStr =
											codeIndent > ZERO
												? ' '.repeat(codeIndent)
												: '';
										// Stack structure: baseIndent + ' * ' + codeIndent + content
										const result = `${commentPrefix}${codeIndentStr}${content}`;
										return result;
									});
									// Ensure closing braces are on separate lines
									// The last line of prefixedLines is the closing brace of the code content (e.g., " * }")
									// We need to add the closing brace for {@code} on a separate line
									// The {@code} closing brace should be " * }" (with comment prefix) on its own line
									formattedWithPrefix = `{@code\n${prefixedLines.join('\n')}\n${commentPrefix}}`;
								} else {
									const trimmedFormatted =
										replacement.formatted.trim();
									formattedWithPrefix =
										trimmedFormatted.length === ZERO
											? '{@code}'
											: `{@code ${trimmedFormatted}}`;
								}
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
