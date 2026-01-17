/**
 * @file Unit tests for print functions in the casing module.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types, @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect } from 'vitest';
import {
	createReservedWordNormalizingPrint,
	createTypeNormalizingPrint,
} from '../../src/casing.js';
import type { ApexNode, ApexIdentifier } from '../../src/types.js';
import { createMockPath, createMockPrint } from '../test-utils.js';

const nodeClassKey = '@class';

describe('casing', () => {
	describe('createTypeNormalizingPrint', () => {
		it.concurrent(
			'should return original print when shouldNormalizeType is false',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint =
					createTypeNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
				} as ApexNode;
				const path = createMockPath(node, 'body');

				const result = typeNormalizingPrint(path);

				expect(result).toBe('original output');
				expect(mockPrint).toHaveBeenCalledWith(path);
			},
		);

		it.concurrent(
			'should normalize single identifier with standard object type',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint =
					createTypeNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account',
				} as ApexIdentifier;
				const path = createMockPath(node, 'type');

				typeNormalizingPrint(path);

				// Should call print with modified node
				expect(mockPrint).toHaveBeenCalled();
			},
		);

		it.concurrent('should handle empty string in identifier value', () => {
			const mockPrint = createMockPrint();
			const typeNormalizingPrint = createTypeNormalizingPrint(mockPrint);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				value: '',
			} as ApexIdentifier;
			const path = createMockPath(node, 'type');

			const result = typeNormalizingPrint(path);

			expect(result).toBe('original output');
			expect(mockPrint).toHaveBeenCalledWith(path);
		});

		it.concurrent(
			'should handle node with names array when key is names',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				const nameNode1 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account',
				} as ApexIdentifier;
				const nameNode2 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'contact',
				} as ApexIdentifier;
				// Node with names array - must pass isIdentifier check (Identifier class)
				// but NOT have a string value property (value must be undefined or non-string)
				// so normalizeNamesArray is called instead of normalizeSingleIdentifier
				const node = {
					names: [nameNode1, nameNode2],
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					// No value property, or value is not a string
				} as ApexNode & { names?: readonly ApexIdentifier[] };
				const path = createMockPath(node, 'names');

				typeNormalizingPrint(path);

				// Should call print (via normalizeNamesArray)
				expect(mockPrint).toHaveBeenCalled();
			},
		);

		it.concurrent(
			'should handle node with names array where names is not an array',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				const node = {
					names: 'not an array',

					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				} as ApexNode & { names?: unknown };
				const path = createMockPath(node, 'names');

				const result = typeNormalizingPrint(path);

				// Should return original print when names is not an array
				expect(result).toBe('original output');
				expect(mockPrint).toHaveBeenCalledWith(path);
			},
		);

		it.concurrent(
			'should handle names array with nodes that have no value property',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				const nameNode1 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					// No value property
				} as ApexNode;
				const nameNode2 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account',
				} as ApexIdentifier;
				const node = {
					names: [
						nameNode1,
						nameNode2,
					] as unknown as readonly ApexIdentifier[],

					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				} as ApexNode & { names?: readonly ApexIdentifier[] };
				const path = createMockPath(node, 'names');

				typeNormalizingPrint(path);

				// Should call print
				expect(mockPrint).toHaveBeenCalled();
			},
		);

		it.concurrent(
			'should handle names array with nodes that have empty string value',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				const nameNode1 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: '',
				} as ApexIdentifier;
				const nameNode2 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account',
				} as ApexIdentifier;
				const node = {
					names: [nameNode1, nameNode2],
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				} as ApexNode & { names?: readonly ApexIdentifier[] };
				const path = createMockPath(node, 'names');

				typeNormalizingPrint(path);

				// Should call print
				expect(mockPrint).toHaveBeenCalled();
			},
		);

		it.concurrent(
			'should handle names array with no changes (values already normalized)',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				const nameNode1 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'Account', // Already normalized
				} as ApexIdentifier;
				const nameNode2 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'Contact', // Already normalized
				} as ApexIdentifier;
				const node = {
					names: [nameNode1, nameNode2],
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				} as ApexNode & { names?: readonly ApexIdentifier[] };
				const path = createMockPath(node, 'names');

				const result = typeNormalizingPrint(path);

				// Should call print and return original output since no changes were made
				expect(mockPrint).toHaveBeenCalled();
				expect(result).toBe('original output');
			},
		);

		it.concurrent(
			'should handle names array restoration with node missing value property',
			() => {
				const mockPrint = createMockPrint();
				// To test the else branch of the restoration condition, we need:
				// 1. originalValues[i] to be defined (so we enter the restoration loop)
				// 2. nameNode to be an object but NOT have 'value' property during restoration
				// We use a Proxy to return different values during try vs finally
				const nameNode1 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account', // Will be normalized, stored in originalValues[0]
				} as ApexIdentifier;
				const nameNode2Original = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'contact', // Will be normalized, stored in originalValues[1]
				} as ApexIdentifier;
				const nameNode2WithoutValue = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					// No value property - to test the else branch
				} as ApexNode;

				// Track access to the array to modify what's returned during restoration
				let accessCount = 0;
				const namesArray = [nameNode1, nameNode2Original];
				const proxiedArray = new Proxy(namesArray, {
					get(target, prop): unknown {
						if (prop === 'length') return target.length;
						if (typeof prop === 'string' && /^\d+$/.test(prop)) {
							const index = Number.parseInt(prop, 10);
							accessCount++;
							const SECOND_INDEX = 1;
							const MIN_ACCESS_COUNT_FOR_FINALLY = 2;
							// After the try block completes (accessCount > 2 means we're in finally),
							// return node without value property to test the else branch
							if (
								index === SECOND_INDEX &&
								accessCount > MIN_ACCESS_COUNT_FOR_FINALLY
							) {
								return nameNode2WithoutValue;
							}
							return target[index];
						}
						return (
							target as unknown as Record<
								string | symbol,
								unknown
							>
						)[prop];
					},
				});

				const node = {
					names: proxiedArray as unknown as readonly ApexIdentifier[],
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				} as ApexNode & { names?: readonly ApexIdentifier[] };
				const path = createMockPath(node, 'names');

				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);

				typeNormalizingPrint(path);

				// Should call print
				expect(mockPrint).toHaveBeenCalled();
			},
		);

		it.concurrent(
			'should skip nameNode with non-string value property',
			() => {
				// Test when nodeValueRaw is not a string - should skip that node
				// normalizeNamesArray is called when isIdent is true and 'names' in node and value is not string
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				const nameNode1 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 123, // Non-string value (number)
				} as unknown as ApexIdentifier;
				const nameNode2 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account', // Valid string value
				} as ApexIdentifier;
				// Use Identifier node with names property to trigger normalizeNamesArray
				// (normalizeNamesArray is called when isIdent is true and 'names' in node and value is not string)
				const node = {
					names: [nameNode1, nameNode2],
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					// value is not a string, so it falls through to normalizeNamesArray check
					value: undefined,
				} as unknown as ApexNode & {
					names?: readonly ApexIdentifier[];
				};
				const path = createMockPath(node, 'names');

				typeNormalizingPrint(path);

				// Should skip nameNode1 (non-string value) but process nameNode2
				expect(mockPrint).toHaveBeenCalled();
			},
		);

		it.concurrent(
			'should handle names array with non-object primitive values',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				// Include non-object primitives to trigger continue for non-objects
				// (typeof nameNode !== 'object' will be true for primitives)
				const nameNode1 = 'string' as unknown as ApexIdentifier;
				const nameNode2 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account',
				} as ApexIdentifier;
				const node = {
					names: [
						nameNode1,
						nameNode2,
					] as unknown as readonly ApexIdentifier[],

					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				} as ApexNode & { names?: readonly ApexIdentifier[] };
				const path = createMockPath(node, 'names');

				typeNormalizingPrint(path);

				// Should call print (primitive should be skipped)
				expect(mockPrint).toHaveBeenCalled();
			},
		);

		it.concurrent('should handle key being undefined', () => {
			const mockPrint = createMockPrint();
			const typeNormalizingPrint = createTypeNormalizingPrint(mockPrint);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
			} as ApexNode;
			const path = createMockPath(node, undefined);

			const result = typeNormalizingPrint(path);

			expect(result).toBe('original output');
			expect(mockPrint).toHaveBeenCalledWith(path);
		});

		it.concurrent('should handle key being null', () => {
			const mockPrint = createMockPrint();
			const typeNormalizingPrint = createTypeNormalizingPrint(mockPrint);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
			} as ApexNode;
			// Create path with null key (which gets normalized to undefined)
			const basePath = createMockPath(node, undefined);
			// eslint-disable-next-line @typescript-eslint/no-misused-spread -- Spread needed to override key property
			const path = { ...basePath, key: null } as typeof basePath;

			const result = typeNormalizingPrint(path);

			expect(result).toBe('original output');
			expect(mockPrint).toHaveBeenCalledWith(path);
		});

		it.concurrent('should handle forceTypeContext parameter', () => {
			const mockPrint = createMockPrint();
			const typeNormalizingPrint = createTypeNormalizingPrint(
				mockPrint,
				true,
			);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				value: 'account',
			} as ApexIdentifier;
			const path = createMockPath(node, 'someKey');

			typeNormalizingPrint(path);

			// Should normalize because forceTypeContext is true
			expect(mockPrint).toHaveBeenCalled();
		});

		it.concurrent('should handle parentKey parameter', () => {
			const mockPrint = createMockPrint();
			const typeNormalizingPrint = createTypeNormalizingPrint(
				mockPrint,
				false,
				'types',
			);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				value: 'account',
			} as ApexIdentifier;
			const path = createMockPath(node, 'someKey');

			typeNormalizingPrint(path);

			// Should normalize because parentKey is 'types'
			expect(mockPrint).toHaveBeenCalled();
		});
	});

	describe('createReservedWordNormalizingPrint', () => {
		it.concurrent(
			'should return original print when node is not an identifier',
			() => {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
				} as ApexNode;
				const path = createMockPath(node, 'body');

				const result = reservedWordNormalizingPrint(path);

				expect(result).toBe('original output');
				expect(mockPrint).toHaveBeenCalledWith(path);
			},
		);

		it.concurrent(
			'should normalize identifier that is a reserved word',
			() => {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'PUBLIC',
				} as ApexIdentifier;
				const path = createMockPath(node, 'modifiers');

				reservedWordNormalizingPrint(path);

				// Should call print with modified node (value normalized to 'public')
				expect(mockPrint).toHaveBeenCalled();
				expect((node as { value: string }).value).toBe('PUBLIC'); // Restored after printing if not in array
			},
		);

		it.concurrent(
			'should normalize identifier in array (modifiers array)',
			() => {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'STATIC',
				} as ApexIdentifier;

				/**
				 * Array index.
				 */
				const path = createMockPath(node, 0);

				reservedWordNormalizingPrint(path);

				// Should call print with modified node (value normalized to 'static')
				expect(mockPrint).toHaveBeenCalled();
				// For arrays, value should remain normalized (not restored)
				expect((node as { value: string }).value).toBe('static');
			},
		);

		it.concurrent(
			'should return original print when identifier is not a reserved word',
			() => {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'MyVariable',
				} as ApexIdentifier;
				const path = createMockPath(node, 'name');

				const result = reservedWordNormalizingPrint(path);

				expect(result).toBe('original output');
				expect(mockPrint).toHaveBeenCalledWith(path);
			},
		);

		it.concurrent('should handle empty string in identifier value', () => {
			const mockPrint = createMockPrint();
			const reservedWordNormalizingPrint =
				createReservedWordNormalizingPrint(mockPrint);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				value: '',
			} as ApexIdentifier;
			const path = createMockPath(node, 'modifiers');

			const result = reservedWordNormalizingPrint(path);

			expect(result).toBe('original output');
			expect(mockPrint).toHaveBeenCalledWith(path);
		});

		it.concurrent(
			'should handle identifier with non-string value property',
			() => {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 123,
				} as ApexNode;
				const path = createMockPath(node, 'modifiers');

				const result = reservedWordNormalizingPrint(path);

				expect(result).toBe('original output');
				expect(mockPrint).toHaveBeenCalledWith(path);
			},
		);

		it.concurrent('should handle null node', () => {
			const mockPrint = createMockPrint();
			const reservedWordNormalizingPrint =
				createReservedWordNormalizingPrint(mockPrint);
			const path = createMockPath(
				null as unknown as ApexNode,
				'modifiers',
			);

			const result = reservedWordNormalizingPrint(path);

			expect(result).toBe('original output');
			expect(mockPrint).toHaveBeenCalledWith(path);
		});

		it.concurrent('should normalize various reserved words', () => {
			const testCases = [
				{ expected: 'public', input: 'PUBLIC' },
				{ expected: 'private', input: 'Private' },
				{ expected: 'static', input: 'STATIC' },
				{ expected: 'class', input: 'Class' },
				{ expected: 'interface', input: 'INTERFACE' },
				{ expected: 'enum', input: 'Enum' },
				{ expected: 'void', input: 'VOID' },
				{ expected: 'abstract', input: 'Abstract' },
				{ expected: 'if', input: 'IF' },
				{ expected: 'else', input: 'Else' },
				{ expected: 'for', input: 'FOR' },
				{ expected: 'while', input: 'While' },
				{ expected: 'return', input: 'RETURN' },
				{ expected: 'try', input: 'Try' },
				{ expected: 'catch', input: 'CATCH' },
				{ expected: 'new', input: 'NEW' },
				{ expected: 'this', input: 'This' },
				{ expected: 'super', input: 'SUPER' },
				{ expected: 'null', input: 'NULL' },
			];

			for (const testCase of testCases) {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: testCase.input,
				} as ApexIdentifier;
				// Use array index to test normalization without restoration
				const path = createMockPath(node, 0);

				reservedWordNormalizingPrint(path);

				// For array indices, value should remain normalized (not restored)
				expect((node as { value: string }).value).toBe(
					testCase.expected,
				);
				expect(mockPrint).toHaveBeenCalled();
			}
		});
	});
});
