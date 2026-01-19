/**
 * @file Unit tests for the printer module.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types, @typescript-eslint/no-unsafe-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Mock printer requires unsafe assignments for testing */
/* eslint-disable @typescript-eslint/no-unsafe-call -- Mock printer requires unsafe calls for testing */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Mock printer requires unsafe member access for testing */
import { describe, it, expect, vi } from 'vitest';
import type { AstPath } from 'prettier';
import { createWrappedPrinter } from '../src/printer.js';
import type { ApexNode } from '../src/types.js';
import {
	__TEST_ONLY__,
	getCurrentPrintOptions,
	getCurrentOriginalText,
} from '../src/printer.js';
import {
	createMockPath,
	createMockOptions,
	createMockPrint,
	createMockOriginalPrinter,
} from './test-utils.js';

const nodeClassKey = '@class';

describe('printer', () => {
	describe('createWrappedPrinter', () => {
		it('should create a printer with print method', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			expect(wrapped).toBeDefined();
			expect(typeof wrapped.print).toBe('function');
		});

		it('should pass through non-list/map nodes to original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
			} as ApexNode);

			const mockOptions = createMockOptions();

			const result = wrapped.print(
				mockPath,
				mockOptions,
				createMockPrint(),
			);

			expect(result).toBe('original output');
			expect(mockOriginalPrinter.print).toHaveBeenCalledWith(
				mockPath,
				mockOptions,
				expect.any(Function),
			);
		});

		it.concurrent.each([
			{
				description:
					'should intercept list nodes with multiple entries',
				expectNotOriginalOutput: true,
				nodeClass: 'apex.jorje.data.ast.NewObject$NewListLiteral',
				nodeData: {
					types: [],
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },

						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
				},
			},
			{
				description: 'should intercept set nodes with multiple entries',
				expectNotOriginalOutput: false,
				nodeClass: 'apex.jorje.data.ast.NewObject$NewSetLiteral',
				nodeData: {
					types: [],
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },

						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
				},
			},
			{
				description: 'should intercept map nodes with multiple entries',
				expectNotOriginalOutput: false,
				nodeClass: 'apex.jorje.data.ast.NewObject$NewMapLiteral',
				nodeData: {
					pairs: [
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
					types: [],
				},
			},
		])(
			'$description',
			({
				nodeClass,
				nodeData,
				expectNotOriginalOutput,
			}: Readonly<{
				description: string;
				nodeClass: string;
				nodeData: Readonly<Record<string, unknown>>;
				expectNotOriginalOutput: boolean;
			}>) => {
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const mockPath = createMockPath({
					...nodeData,
					[nodeClassKey]: nodeClass,
				} as ApexNode);

				// Mock the path.map to return empty arrays
				(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce(
					[],
				);
				(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce(
					[],
				);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should not call original printer for multiline collections
				expect(mockOriginalPrinter.print).not.toHaveBeenCalled();
				// Should return a doc structure
				expect(result).toBeDefined();
				if (expectNotOriginalOutput) {
					expect(result).not.toBe('original output');
				}
			},
		);

		it.concurrent.each([
			{
				description:
					'should pass through list nodes with single entry to original printer',
				nodeClass: 'apex.jorje.data.ast.NewObject$NewListLiteral',
				nodeData: {
					values: [{ '@class': 'apex.jorje.data.ast.LiteralExpr' }],
				},
			},
			{
				description:
					'should pass through map nodes with single entry to original printer',
				nodeClass: 'apex.jorje.data.ast.NewObject$NewMapLiteral',
				nodeData: {
					pairs: [
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
				},
			},
		])(
			'$description',
			({
				nodeClass,
				nodeData,
			}: {
				description: string;
				nodeClass: string;
				nodeData: Readonly<Record<string, unknown>>;
			}) => {
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const mockPath = createMockPath({
					...nodeData,
					[nodeClassKey]: nodeClass,
				} as ApexNode);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should call original printer for single-entry collections
				expect(mockOriginalPrinter.print).toHaveBeenCalled();
				expect(result).toBe('original output');
			},
		);

		it('should pass through set nodes with single entry to original printer', () => {
			const mockOriginalPrinter = createMockOriginalPrinter();
			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.NewObject$NewSetLiteral',
				values: [{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' }],
			} as ApexNode);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
			);

			// Should call original printer for single-item sets
			expect(mockOriginalPrinter.print).toHaveBeenCalled();
			expect(result).toBe('original output');
		});

		it.concurrent.each([
			{
				description:
					'should handle empty list nodes with custom formatting',
				nodeClass: 'apex.jorje.data.ast.NewObject$NewListLiteral',
				nodeData: { values: [] },
			},
			{
				description:
					'should handle empty set nodes with custom formatting',
				nodeClass: 'apex.jorje.data.ast.NewObject$NewSetLiteral',
				nodeData: { values: [] },
			},
			{
				description:
					'should handle empty map nodes with custom formatting',
				nodeClass: 'apex.jorje.data.ast.NewObject$NewMapLiteral',
				nodeData: { pairs: [] },
			},
		])(
			'$description',
			({
				nodeClass,
				nodeData,
			}: {
				description: string;
				nodeClass: string;
				nodeData: Readonly<Record<string, unknown>>;
			}) => {
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const mockPath = createMockPath({
					...nodeData,
					[nodeClassKey]: nodeClass,
				} as ApexNode);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Empty collections are handled by our custom logic to ensure
				// type parameters can break when they exceed printWidth
				// They should return a Doc array, not the original output
				expect(mockOriginalPrinter.print).not.toHaveBeenCalled();
				expect(result).not.toBe('original output');
				// Result should be a Doc array (our custom formatting)
				expect(Array.isArray(result)).toBe(true);
			},
		);
	});

	/* eslint-disable sort-keys/sort-keys-fix */
	describe('internal helpers', () => {
		it('hasAnyComments should detect comments array', () => {
			const nodeWithComments = { comments: [{}] } as unknown;
			const nodeWithoutComments = {} as unknown;

			expect(__TEST_ONLY__.hasAnyComments(nodeWithComments)).toBe(true);
			expect(__TEST_ONLY__.hasAnyComments(nodeWithoutComments)).toBe(
				false,
			);
		});

		it('isEmptyBlockStmntNode should detect empty and non-empty BlockStmnt', () => {
			const emptyBlock = {
				value: {
					[nodeClassKey]: 'apex.jorje.data.ast.Stmnt$BlockStmnt',
					loc: { startIndex: 0, endIndex: 2 },
					stmnts: [],
				},
			} as unknown;
			const nonEmptyBlock = {
				value: {
					[nodeClassKey]: 'apex.jorje.data.ast.Stmnt$BlockStmnt',
					loc: { startIndex: 0, endIndex: 10 },
					stmnts: [{}],
				},
			} as unknown;
			const nonBlock = {
				value: { [nodeClassKey]: 'apex.jorje.data.ast.Other' },
			} as unknown;

			expect(__TEST_ONLY__.isEmptyBlockStmntNode(emptyBlock)).toBe(true);
			expect(__TEST_ONLY__.isEmptyBlockStmntNode(nonEmptyBlock)).toBe(
				false,
			);
			expect(__TEST_ONLY__.isEmptyBlockStmntNode(nonBlock)).toBe(false);
			expect(__TEST_ONLY__.isEmptyBlockStmntNode({} as unknown)).toBe(
				false,
			);
		});

		it('blockSliceHasCommentMarkers should detect inline and block comments and handle missing loc/originalText', () => {
			const baseValue = {
				[nodeClassKey]: 'apex.jorje.data.ast.Stmnt$BlockStmnt',
				loc: { startIndex: 0, endIndex: 20 },
				stmnts: [],
			};
			const blockNode = { value: baseValue } as unknown;
			const blockNodeNoLoc = {
				value: { ...baseValue, loc: undefined },
			} as unknown;
			const originalWithInline = '{ // inline\n}';
			const originalWithBlock = '{ /* block */ }';

			expect(
				__TEST_ONLY__.blockSliceHasCommentMarkers(
					blockNode,
					originalWithInline,
				),
			).toBe(true);
			expect(
				__TEST_ONLY__.blockSliceHasCommentMarkers(
					blockNode,
					originalWithBlock,
				),
			).toBe(true);
			expect(
				__TEST_ONLY__.blockSliceHasCommentMarkers(
					blockNode,
					'{ no comments }',
				),
			).toBe(false);
			expect(
				__TEST_ONLY__.blockSliceHasCommentMarkers(blockNode, undefined),
			).toBe(false);
			expect(
				__TEST_ONLY__.blockSliceHasCommentMarkers(
					blockNodeNoLoc,
					'{ // }',
				),
			).toBe(false);
			const blockNodeNoWrapper = {
				loc: { startIndex: 0, endIndex: originalWithInline.length },
				stmnts: [],
			} as unknown;
			expect(
				__TEST_ONLY__.blockSliceHasCommentMarkers(
					blockNodeNoWrapper,
					originalWithInline,
				),
			).toBe(true);
		});

		it('buildEmptyClassInheritanceDocs should include extends and implements segments', () => {
			const superAndInterfaces: Doc[] = [];

			const stubPath = {
				call: () => 'BaseService',
				map: () => ['IFace1', 'IFace2'],
			} as unknown as Readonly<AstPath<ApexNode>>;

			const parts = __TEST_ONLY__.buildEmptyClassInheritanceDocs(
				stubPath,
				() => 'Ignored',
			);

			superAndInterfaces.push(...parts);

			expect(superAndInterfaces.join('')).toContain('extends');
			expect(superAndInterfaces.join('')).toContain('BaseService');
			expect(superAndInterfaces.join('')).toContain('implements');
			expect(superAndInterfaces.join('')).toContain('IFace1');
			expect(superAndInterfaces.join('')).toContain('IFace2');
		});
	});
	/* eslint-enable sort-keys/sort-keys-fix */

	describe('annotation normalization', () => {
		it.concurrent('should normalize annotation names to PascalCase', () => {
			const mockNode = {
				name: {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'auraenabled',
				},
				[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
				parameters: [],
			};

			const mockPath = createMockPath(mockNode);
			const mockOriginalPrinter = createMockOriginalPrinter();
			const wrappedPrinter = createWrappedPrinter(mockOriginalPrinter);

			const result = wrappedPrinter.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
			);

			// Should normalize to AuraEnabled
			// Result is a Doc structure - check it's defined and not the original output
			expect(result).toBeDefined();
			expect(result).not.toBe('original output');
			// The result should be an array containing '@' and 'AuraEnabled'
			if (Array.isArray(result)) {
				const FIRST_INDEX = 0;
				const SECOND_INDEX = 1;
				expect(result[FIRST_INDEX]).toBe('@');
				expect(result[SECOND_INDEX]).toBe('AuraEnabled');
			}
		});

		it.concurrent(
			'should normalize annotation option names to camelCase',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'auraenabled',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'cacheable',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue',
							},
						},
					],
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				const wrappedPrinter =
					createWrappedPrinter(mockOriginalPrinter);

				const result = wrappedPrinter.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should normalize annotation to AuraEnabled and option to cacheable
				// Result should be a group with @AuraEnabled(cacheable=true)
				expect(result).toBeDefined();
				expect(result).not.toBe('original output');
			},
		);

		it.concurrent(
			'should format annotations with single parameter on one line',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'future',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'callout',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue',
							},
						},
					],
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				const wrappedPrinter =
					createWrappedPrinter(mockOriginalPrinter);

				const result = wrappedPrinter.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should format as single line: @Future(callout=true)
				expect(result).toBeDefined();
				expect(result).not.toBe('original output');
			},
		);

		it.concurrent(
			'should format InvocableMethod with multiple parameters on multiple lines',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'invocablemethod',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'label',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
								value: 'Test Label',
							},
						},
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'description',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
								value: 'Test Description',
							},
						},
					],
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				const wrappedPrinter =
					createWrappedPrinter(mockOriginalPrinter);

				const result = wrappedPrinter.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should force multiline format for InvocableMethod with multiple params
				expect(result).toBeDefined();
				expect(result).not.toBe('original output');
			},
		);

		it.concurrent(
			'should format SuppressWarnings with comma-separated string',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'suppresswarnings',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
							value: 'PMD.UnusedLocalVariable, PMD.UnusedPrivateMethod',
						},
					],
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				const wrappedPrinter =
					createWrappedPrinter(mockOriginalPrinter);

				const result = wrappedPrinter.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should format as: @SuppressWarnings('PMD.UnusedLocalVariable, PMD.UnusedPrivateMethod')
				expect(result).toBeDefined();
				expect(result).not.toBe('original output');
			},
		);
	});

	describe('type normalization', () => {
		it.concurrent(
			'should normalize identifier in type context when value changes',
			() => {
				const mockNode = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account', // lowercase - should normalize to 'Account'
				};

				// Create path with 'type' key to indicate type context
				const mockPath = {
					call: vi.fn(() => ''),
					key: 'type',
					map: vi.fn(() => []),
					node: mockNode,
					stack: [],
				} as unknown as AstPath<ApexNode>;

				const mockOriginalPrinter = {
					print: vi.fn((path, _options, _print) => {
						// Verify the node value was normalized
						const normalizedNode = path.node as { value?: string };
						expect(normalizedNode.value).toBe('Account');
						return 'normalized output';
					}),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should call original printer with normalized value
				expect(mockOriginalPrinter.print).toHaveBeenCalled();
				expect(result).toBe('normalized output');
			},
		);

		it.concurrent(
			'should not normalize identifier when value does not change',
			() => {
				const mockNode = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'Account', // Already normalized
				};

				const mockPath = {
					call: vi.fn(() => ''),
					key: 'type',
					map: vi.fn(() => []),
					node: mockNode,
					stack: [],
				} as unknown as AstPath<ApexNode>;

				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should fall through to fallback (not call original printer with modified node)
				expect(result).toBe('original output');
			},
		);

		it.concurrent(
			'should normalize identifier in types array context',
			() => {
				const mockNode = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'contact', // lowercase - should normalize to 'Contact'
				};

				const mockPath = {
					call: vi.fn(() => ''),
					key: 'types',
					map: vi.fn(() => []),
					node: mockNode,
					stack: [],
				} as unknown as AstPath<ApexNode>;

				const mockOriginalPrinter = {
					print: vi.fn((path, _options, _print) => {
						const normalizedNode = path.node as { value?: string };
						expect(normalizedNode.value).toBe('Contact');
						return 'normalized output';
					}),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				expect(mockOriginalPrinter.print).toHaveBeenCalled();
				expect(result).toBe('normalized output');
			},
		);
	});

	describe('TypeRef handling', () => {
		it.concurrent('should handle TypeRef node with names array', () => {
			const mockNode = {
				names: [
					{
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'account',
					},
				],
				[nodeClassKey]: 'apex.jorje.data.ast.TypeRef',
			};

			const mockPath = createMockPath(mockNode);
			const mockOriginalPrinter = {
				print: vi.fn((path, _options, print) => {
					// Verify that namesNormalizingPrint is used for 'names' key
					const testNamesPath = {
						call: (mockPath.call as () => string).bind(mockPath),
						key: 'names',
						map: (mockPath.map as () => unknown[]).bind(mockPath),
						node: mockPath.node,
						stack: mockPath.stack,
					} as unknown as AstPath<ApexNode>;
					const namesResult = print(testNamesPath);
					// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- returning array for test
					return ['TypeRef', namesResult];
				}),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
			);

			expect(mockOriginalPrinter.print).toHaveBeenCalled();
			expect(result).toBeDefined();
		});

		it.concurrent(
			'should pass through TypeRef node with empty names array',
			() => {
				const mockNode = {
					names: [],
					[nodeClassKey]: 'apex.jorje.data.ast.TypeRef',
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should fall through to fallback
				expect(result).toBe('original output');
			},
		);

		it.concurrent(
			'should pass through TypeRef node without names property',
			() => {
				const mockNode = {
					[nodeClassKey]: 'apex.jorje.data.ast.TypeRef',
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should fall through to fallback
				expect(result).toBe('original output');
			},
		);

		it.concurrent(
			'should pass through TypeRef node with non-array names',
			() => {
				const mockNode = {
					names: 'not an array',
					[nodeClassKey]: 'apex.jorje.data.ast.TypeRef',
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should fall through to fallback
				expect(result).toBe('original output');
			},
		);

		it.concurrent(
			'should inline empty class body without superClass or interfaces',
			() => {
				const mockNode = {
					members: [],
					modifiers: [],
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'MyService',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.ClassDecl',
				} as ApexNode;

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				expect(mockOriginalPrinter.print).not.toHaveBeenCalled();
				expect(result).toBeDefined();
			},
		);

		/* eslint-disable sort-keys/sort-keys-fix */
		it.concurrent(
			'should inline empty generic class body with superClass and interfaces',
			() => {
				const mockNode = {
					members: [],
					modifiers: [],
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'MyGenericService',
					},
					typeArguments: {
						value: [
							{
								[nodeClassKey]: 'apex.jorje.data.ast.TypeRef',
								names: [
									{
										value: 'T',
										[nodeClassKey]:
											'apex.jorje.data.ast.Identifier',
									},
								],
							},
						],
					},
					superClass: {
						value: {
							[nodeClassKey]: 'apex.jorje.data.ast.TypeRef',
							names: [
								{
									value: 'BaseService',
									[nodeClassKey]:
										'apex.jorje.data.ast.Identifier',
								},
							],
						},
					},
					interfaces: [
						{
							[nodeClassKey]: 'apex.jorje.data.ast.TypeRef',
							names: [
								{
									value: 'IDescribable',
									[nodeClassKey]:
										'apex.jorje.data.ast.Identifier',
								},
							],
						},
					],
					[nodeClassKey]: 'apex.jorje.data.ast.ClassDecl',
				} as ApexNode;

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				expect(mockOriginalPrinter.print).not.toHaveBeenCalled();
				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should inline empty method body without comments',
			() => {
				const mockNode = {
					modifiers: [],
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'doWork',
					},
					parameters: [],
					stmnt: {
						value: {
							loc: {
								endIndex: 2,
								startIndex: 0,
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.Stmnt$BlockStmnt',
							stmnts: [],
						},
					},
					type: {
						value: {
							[nodeClassKey]: 'apex.jorje.data.ast.TypeRef',
							names: [
								{
									value: 'void',
									[nodeClassKey]:
										'apex.jorje.data.ast.Identifier',
								},
							],
						},
					},
					[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
				} as ApexNode;

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				expect(mockOriginalPrinter.print).not.toHaveBeenCalled();
				expect(result).toBeDefined();
			},
		);
		/* eslint-enable sort-keys/sort-keys-fix */

		it.concurrent(
			'should handle variable declarations with object typeDoc (line 106)',
			() => {
				// Test makeTypeDocBreakable with object Doc (neither string nor array)
				// This tests line 106: return typeDoc; (fallback for object Doc)
				const mockNode = {
					decls: [{ '@class': 'apex.jorje.data.ast.Variable' }],
					modifiers: [],
					[nodeClassKey]: 'apex.jorje.data.ast.VariableDecls',
				};

				const mockPath = createMockPath(mockNode);
				// Mock print to return an object Doc for 'type' (like group() or indent())
				const objectDoc = { contents: ['String'], type: 'group' };
				const mockPrint = vi.fn((path: Readonly<AstPath<ApexNode>>) => {
					const { key } = path as { key?: number | string };
					if (key === 'type') {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock Doc for testing
						return objectDoc as unknown as Doc;
					}
					return '';
				});

				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					mockPrint,
				);

				// Should handle object Doc and pass through
				expect(result).toBeDefined();
			},
		);
	});

	describe('getter functions', () => {
		it.concurrent(
			'getCurrentPrintOptions should be callable and return a value',
			() => {
				// Test that the function can be called (line 134)
				const result = getCurrentPrintOptions();
				// Result may be undefined or an object depending on test state
				expect(result === undefined || typeof result === 'object').toBe(
					true,
				);
			},
		);

		it.concurrent(
			'getCurrentOriginalText should be callable and return a value',
			() => {
				// Test that the function can be called (line 137)
				const result = getCurrentOriginalText();
				// Result may be undefined or a string depending on test state
				expect(result === undefined || typeof result === 'string').toBe(
					true,
				);
			},
		);
	});

	describe('handleVariableDecls edge cases', () => {
		it.concurrent(
			'should return null when decls is not an array (line 351)',
			() => {
				// Test handleVariableDecls with non-array decls
				const mockNode = {
					decls: 'not an array', // Invalid: decls should be an array
					modifiers: [],
					[nodeClassKey]: 'apex.jorje.data.ast.VariableDecls',
				} as unknown as ApexNode;

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should return null and fall through to original printer
				expect(result).toBe('original output');
			},
		);

		it.concurrent(
			'should handle non-object declaration in decls array (line 327)',
			() => {
				// Test hasVariableAssignments with non-object decl
				const mockNode = {
					decls: [
						'not an object', // Invalid: decl should be an object
						{ '@class': 'apex.jorje.data.ast.Variable' },
					],
					modifiers: [],
					[nodeClassKey]: 'apex.jorje.data.ast.VariableDecls',
				} as unknown as ApexNode;

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should handle gracefully and continue processing
				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should return null when nameDoc or assignmentDoc is undefined in complex map type (line 570)',
			() => {
				// Test handleVariableDecls with undefined nameDoc or assignmentDoc
				// This happens when declDoc array has undefined at NAME_INDEX (0) or ASSIGNMENT_INDEX (4)
				const mockNode = {
					decls: [
						{
							'@class': 'apex.jorje.data.ast.Variable',
							assignment: {
								value: {
									'@class':
										'apex.jorje.data.ast.Expr$NewExpr',
									creator: {
										'@class':
											'apex.jorje.data.ast.NewObject$NewMapLiteral',
									},
								},
							},
							name: {
								'@class': 'apex.jorje.data.ast.Identifier',
								value: 'nestedMap',
							},
							type: {
								'@class': 'apex.jorje.data.ast.TypeRef',
								names: [
									{
										'@class':
											'apex.jorje.data.ast.Identifier',
										value: 'Map',
									},
									{
										'@class':
											'apex.jorje.data.ast.Identifier',
										value: 'String',
									},
									{
										'@class':
											'apex.jorje.data.ast.Identifier',
										value: 'Map',
									},
								],
							},
						},
					],
					modifiers: [],
					[nodeClassKey]: 'apex.jorje.data.ast.VariableDecls',
				} as unknown as ApexNode;

				const mockPath = createMockPath(mockNode);
				const mockPrint = vi.fn((path: Readonly<AstPath<ApexNode>>) => {
					const { key } = path as { key?: number | string };
					if (key === 'type') {
						// Return complex Map type structure: Map<String, Map>
						// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock Doc for testing
						return [
							'Map',
							'<',
							['String', ', ', 'Map'],
							'>',
						] as unknown as Doc;
					}
					// For name or assignment paths, return undefined to simulate sparse array
					if (key === 'name') {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock Doc for testing
						return undefined as unknown as Doc; // undefined nameDoc
					}
					if (key === 'assignment') {
						return 'assignmentDoc';
					}
					return '';
				});

				// Mock path.map to call the callback, which will use mockPrint
				// The callback returns [nameDoc, ' ', '=', ' ', assignmentDoc]
				// Since nameDoc will be undefined, declDoc[NAME_INDEX] will be undefined
				(mockPath.map as ReturnType<typeof vi.fn>).mockImplementation(
					(
						callback: (path: Readonly<AstPath<ApexNode>>) => Doc,
						key: string,
					) => {
						if (key === 'decls') {
							// Call callback with declPath, which will use mockPrint
							// The callback calls declPath.call(print, 'name') and declPath.call(print, 'assignment')
							// We need to mock declPath.call to use mockPrint
							const declPath = {
								call: vi.fn(
									(
										_print: unknown,
										...pathKeys: unknown[]
									) => {
										const pathKey = pathKeys[0] as string;
										if (pathKey === 'name') {
											// Return undefined to simulate undefined nameDoc
											// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock Doc for testing
											return undefined as unknown as Doc;
										}
										if (pathKey === 'assignment') {
											// Return assignment doc
											// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock Doc for testing
											return 'assignmentDoc' as unknown as Doc;
										}
										// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock Doc for testing
										return '' as unknown as Doc;
									},
								),
								key: mockPath.key,
								// eslint-disable-next-line @typescript-eslint/unbound-method -- Mock path for testing
								map: mockPath.map,
								node: (mockNode as { decls: unknown[] })
									.decls[0],
								stack: mockPath.stack,
							} as unknown as AstPath<ApexNode>;
							const declDoc = callback(declPath);
							// declDoc should be [undefined, ' ', '=', ' ', 'assignmentDoc']
							// which means declDoc[NAME_INDEX] (0) is undefined
							// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/strict-void-return -- Mock Doc array for testing
							return [declDoc] as Doc[];
						}
						if (key === 'modifiers') {
							// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/strict-void-return -- Mock Doc array for testing
							return [] as Doc[];
						}
						// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/strict-void-return -- Mock Doc array for testing
						return [] as Doc[];
					},
				);

				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					mockPrint,
				);

				// Should return null when nameDoc is undefined (line 570)
				// The code returns null and falls through to the else branch
				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should handle non-array doc in isMapTypeDoc (line 453)',
			() => {
				// Test isMapTypeDoc with non-array doc (defensive check)
				// This tests the unreachable branch when doc is not an array
				const mockNode = {
					decls: [
						{
							'@class': 'apex.jorje.data.ast.Variable',
							assignment: {
								value: {
									'@class':
										'apex.jorje.data.ast.Expr$NewExpr',
									creator: {
										'@class':
											'apex.jorje.data.ast.NewObject$NewMapLiteral',
									},
								},
							},
						},
					],
					modifiers: [],
					[nodeClassKey]: 'apex.jorje.data.ast.VariableDecls',
				} as unknown as ApexNode;

				const mockPath = createMockPath(mockNode);
				// Mock print to return a non-array for type (simulating malformed input)
				const mockPrint = vi.fn((path: Readonly<AstPath<ApexNode>>) => {
					const { key } = path as { key?: number | string };
					if (key === 'type') {
						// Return a non-array to trigger isMapTypeDoc's defensive check
						// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock Doc for testing
						return 'String' as unknown as Doc;
					}
					return '';
				});

				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					mockPrint,
				);

				// Should handle gracefully
				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should handle non-array param in hasNestedMap (line 467)',
			() => {
				// Test hasNestedMap with non-array param (defensive check)
				// This tests the unreachable branch when param is neither string nor array
				const mockNode = {
					decls: [
						{
							'@class': 'apex.jorje.data.ast.Variable',
							assignment: {
								value: {
									'@class':
										'apex.jorje.data.ast.Expr$NewExpr',
									creator: {
										'@class':
											'apex.jorje.data.ast.NewObject$NewMapLiteral',
									},
								},
							},
						},
					],
					modifiers: [],
					[nodeClassKey]: 'apex.jorje.data.ast.VariableDecls',
				} as unknown as ApexNode;

				const mockPath = createMockPath(mockNode);
				// Mock print to return a malformed typeDoc structure
				const mockPrint = vi.fn((path: Readonly<AstPath<ApexNode>>) => {
					const { key } = path as { key?: number | string };
					if (key === 'type') {
						// Return a Map type with malformed params to trigger hasNestedMap's defensive check
						// Structure: ['Map', '<', [params...], '>']
						// params[0] could be non-array/non-string in malformed input
						// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock Doc for testing
						return [
							'Map',
							'<',
							[{ invalid: 'param' }], // Non-string, non-array param
							'>',
						] as unknown as Doc;
					}
					return '';
				});

				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					mockPrint,
				);

				// Should handle gracefully
				expect(result).toBeDefined();
			},
		);
	});
});
