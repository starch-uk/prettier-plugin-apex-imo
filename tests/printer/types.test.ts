/**
 * @file Unit tests for type normalization and TypeRef handling in the printer module.
 */

import { describe, it, expect, vi } from 'vitest';
import type { AstPath, Doc } from 'prettier';
import { createWrappedPrinter } from '../../src/printer.js';
import type { ApexNode } from '../../src/types.js';
import {
	createMockPath,
	createMockOptions,
	createMockPrint,
} from '../test-utils.js';

const nodeClassKey = '@class';

describe('printer', () => {
	describe('type normalization', () => {
		it.concurrent(
			'should normalize identifier in type context when value changes',
			() => {
				const mockNode = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account', // lowercase - should normalize to 'Account'
				};

				// Create path with 'type' key to indicate type context
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path type assertion for test
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
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-member-access -- path.node is checked
						const normalizedNode = path.node as { value?: string };
						expect(normalizedNode.value).toBe('Account');
						return 'normalized output';
					}),
				};

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
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

				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path type assertion for test
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

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
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

				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path type assertion for test
				const mockPath = {
					call: vi.fn(() => ''),
					key: 'types',
					map: vi.fn(() => []),
					node: mockNode,
					stack: [],
				} as unknown as AstPath<ApexNode>;

				const mockOriginalPrinter = {
					print: vi.fn((path, _options, _print) => {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-member-access -- path.node is checked
						const normalizedNode = path.node as { value?: string };
						expect(normalizedNode.value).toBe('Contact');
						return 'normalized output';
					}),
				};

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
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
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path type assertions for test
					const testNamesPath = {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock function type assertions for test
						call: (mockPath.call as () => string).bind(mockPath),
						key: 'names',
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock function type assertions for test
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

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
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

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
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

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
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

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
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
			'should handle variable declarations with object typeDoc',
			() => {
				// Test makeTypeDocBreakable with object Doc (neither string nor array)
				// This tests fallback for object Doc
				const mockNode = {
					decls: [{ '@class': 'apex.jorje.data.ast.Variable' }],
					modifiers: [],
					[nodeClassKey]: 'apex.jorje.data.ast.VariableDecls',
				};

				const mockPath = createMockPath(mockNode);
				// Mock print to return an object Doc for 'type' (like group() or indent())
				const objectDoc = { contents: ['String'], type: 'group' };
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
				const mockPrint = vi.fn((path: Readonly<AstPath<ApexNode>>) => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- path key extraction for test
					const { key } = path as { key?: number | string };
					if (key === 'type') {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Doc type assertion for test
						return objectDoc as unknown as Doc;
					}
					return '';
				});

				// Mock path.call to return objectDoc when called with 'type'
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock function type assertion for test
				(mockPath.call as ReturnType<typeof vi.fn>).mockImplementation(
					// eslint-disable-next-line @typescript-eslint/strict-void-return -- Mock function returns Doc
					(_print: unknown, key: unknown): Doc => {
						if (key === 'type') {
							// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Doc type assertion for test
							return objectDoc as unknown as Doc;
						}
						return '';
					},
				);

				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
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
});
