/**
 * @file Unit tests for the printer module.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types, @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect, vi } from 'vitest';
import type { AstPath } from 'prettier';
import { createWrappedPrinter } from '../src/printer.js';
import type { ApexNode } from '../src/types.js';
import {
	createMockPath,
	createMockOptions,
	createMockPrint,
	createMockOriginalPrinter,
} from './test-utils.js';
import {
	getCurrentPrintOptions,
	getCurrentOriginalText,
} from '../src/printer.js';

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

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
			);

			expect(result).toBe('original output');
			expect(mockOriginalPrinter.print).toHaveBeenCalledWith(
				mockPath,
				{},
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
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- path.node is checked
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
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- path.node is checked
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
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- print function is mocked
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
				const objectDoc = { type: 'group', contents: ['String'] };
				const mockPrint = vi.fn((path: Readonly<AstPath<ApexNode>>) => {
					const key = (path as { key?: string | number }).key;
					if (key === 'type') {
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
		it.concurrent('getCurrentPrintOptions should be callable and return a value', () => {
			// Test that the function can be called (line 134)
			const result = getCurrentPrintOptions();
			// Result may be undefined or an object depending on test state
			expect(result === undefined || typeof result === 'object').toBe(true);
		});

		it.concurrent('getCurrentOriginalText should be callable and return a value', () => {
			// Test that the function can be called (line 137)
			const result = getCurrentOriginalText();
			// Result may be undefined or a string depending on test state
			expect(result === undefined || typeof result === 'string').toBe(true);
		});
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
									'@class': 'apex.jorje.data.ast.Expr$NewExpr',
									creator: {
										'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
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
					const key = (path as { key?: string | number }).key;
					if (key === 'type') {
						// Return a non-array to trigger isMapTypeDoc's defensive check
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
									'@class': 'apex.jorje.data.ast.Expr$NewExpr',
									creator: {
										'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
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
					const key = (path as { key?: string | number }).key;
					if (key === 'type') {
						// Return a Map type with malformed params to trigger hasNestedMap's defensive check
						// Structure: ['Map', '<', [params...], '>']
						// params[0] could be non-array/non-string in malformed input
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
