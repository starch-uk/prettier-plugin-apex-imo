/**
 * @file Unit tests for the casing module.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types, @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect, test } from 'vitest';
import {
	normalizeTypeName,
	isIdentifier,
	isInTypeContext,
	createTypeNormalizingPrint,
} from '../src/casing.js';
import { STANDARD_OBJECTS } from '../src/refs/standard-objects.js';
import { APEX_OBJECT_SUFFIXES } from '../src/refs/object-suffixes.js';
import type { ApexNode, ApexIdentifier } from '../src/types.js';
import { createMockPath, createMockPrint } from './test-utils.js';

const nodeClassKey = '@class';

describe('casing', () => {

	describe('normalizeTypeName', () => {
		it.concurrent(
			'should normalize standard objects and then suffixes',
			() => {
				// Test that standard object normalization happens first, then suffix normalization
				expect(normalizeTypeName('account__C')).toBe('Account__c');
				expect(normalizeTypeName('contact__c')).toBe('Contact__c');
				expect(normalizeTypeName('MyCustomObject__C')).toBe(
					'MyCustomObject__c',
				);
			},
		);

		it.concurrent(
			'should handle types with only standard object normalization',
			() => {
				expect(normalizeTypeName('account')).toBe('Account');
				expect(normalizeTypeName('contact')).toBe('Contact');
			},
		);

		it.concurrent(
			'should handle types with only suffix normalization',
			() => {
				expect(normalizeTypeName('MyCustomObject__C')).toBe(
					'MyCustomObject__c',
				);
				expect(normalizeTypeName('MyCustomObject__CHANGEEVENT')).toBe(
					'MyCustomObject__ChangeEvent',
				);
			},
		);

		it.concurrent('should handle empty string', () => {
			expect(normalizeTypeName('')).toBe('');
		});

		it.concurrent(
			'should return unchanged for types without normalization needs',
			() => {
				expect(normalizeTypeName('MyCustomClass')).toBe(
					'MyCustomClass',
				);
				expect(normalizeTypeName('String')).toBe('String');
			},
		);
	});

	describe('isIdentifier', () => {
		it.concurrent.each([
			{
				description: 'should identify Identifier class nodes',
				expected: true,
				node: {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'Test',
				} as ApexNode,
			},
			{
				description:
					'should identify nodes with Identifier in class name',
				expected: true,
				node: {
					[nodeClassKey]: 'apex.jorje.data.ast.SomeIdentifier',
					value: 'Test',
				} as ApexNode,
			},
			{
				description: 'should identify nodes with value property',
				expected: true,
				node: {
					[nodeClassKey]: 'apex.jorje.data.ast.SomeNode',
					value: 'Test',
				} as ApexNode,
			},
			{
				description: 'should reject nodes without value property',
				expected: false,
				node: {
					[nodeClassKey]: 'apex.jorje.data.ast.SomeNode',
				} as ApexNode,
			},
			{
				description: 'should reject null nodes',
				expected: false,
				node: null,
			},
			{
				description: 'should reject undefined nodes',
				expected: false,
				node: undefined,
			},
		])(
			'$description',
			({
				expected,
				node,
			}: Readonly<{
				description: string;
				expected: boolean;
				node: ApexNode | null | undefined;
			}>) => {
				expect(isIdentifier(node)).toBe(expected);
			},
		);
	});

	describe('isInTypeContext', () => {
		it.concurrent('should return true when key is "types"', () => {
			const path = createMockPath({} as ApexNode, 'types');
			expect(isInTypeContext(path)).toBe(true);
		});

		it.concurrent(
			'should return true when key is in TYPE_CONTEXT_KEYS',
			() => {
				const path = createMockPath({} as ApexNode, 'type');
				expect(isInTypeContext(path)).toBe(true);
			},
		);

		it.concurrent('should return true when key starts with "type"', () => {
			const path = createMockPath({} as ApexNode, 'typeParameter');
			expect(isInTypeContext(path)).toBe(true);
		});

		it.concurrent(
			'should return true for "field" key when FromExpr is in stack',
			() => {
				const parentNode = {
					[nodeClassKey]: 'apex.jorje.data.ast.FromExpr',
				} as ApexNode;
				const stack = [parentNode];
				const path = createMockPath({} as ApexNode, 'field', stack);
				expect(isInTypeContext(path)).toBe(true);
			},
		);

		it.concurrent(
			'should return false for "field" key when FromExpr is not in stack',
			() => {
				const path = createMockPath({} as ApexNode, 'field');
				expect(isInTypeContext(path)).toBe(false);
			},
		);

		it.concurrent('should return true when parent is TypeRef', () => {
			const parentNode = {
				[nodeClassKey]: 'apex.jorje.data.ast.TypeRef',
			} as ApexNode;
			// Stack length 2: parent is at index 0 (stack.length - 2 = 0)
			const stack = [parentNode, {}];
			const path = createMockPath({} as ApexNode, undefined, stack);
			expect(isInTypeContext(path)).toBe(true);
		});

		it.concurrent(
			'should return true when parent class includes "Type" but not "Variable"',
			() => {
				const parentNode = {
					[nodeClassKey]: 'apex.jorje.data.ast.SomeTypeNode',
				} as ApexNode;
				// Stack length 2: parent is at index 0
				const stack = [parentNode, {}];
				const path = createMockPath({} as ApexNode, undefined, stack);
				expect(isInTypeContext(path)).toBe(true);
			},
		);

		it.concurrent(
			'should return false when parent class includes "Type" and "Variable" with key "name"',
			() => {
				const parentNode = {
					[nodeClassKey]: 'apex.jorje.data.ast.VariableTypeNode',
				} as ApexNode;
				// Stack length 2: parent is at index 0
				const stack = [parentNode, {}];
				const path = createMockPath({} as ApexNode, 'name', stack);
				expect(isInTypeContext(path)).toBe(false);
			},
		);

		it.concurrent(
			'should return true when key is "name" and parent class includes "Type" but not "Variable"',
			() => {
				const parentNode = {
					[nodeClassKey]: 'apex.jorje.data.ast.SomeTypeNode',
				} as ApexNode;
				// Stack length 2: parent is at index 0
				const stack = [parentNode, {}];
				// This tests the branch: key !== 'name' || !parentClass.includes('Variable')
				// When key === 'name' and parentClass does NOT include 'Variable', the second part is true
				const path = createMockPath({} as ApexNode, 'name', stack);
				expect(isInTypeContext(path)).toBe(true);
			},
		);

		it.concurrent(
			'should return true when parent class includes "FromExpr"',
			() => {
				const parentNode = {
					[nodeClassKey]: 'apex.jorje.data.ast.SomeFromExprNode',
				} as ApexNode;
				// Stack length 2: parent is at index 0
				const stack = [parentNode, {}];
				const path = createMockPath({} as ApexNode, undefined, stack);
				expect(isInTypeContext(path)).toBe(true);
			},
		);

		it.concurrent('should return true when parent has types array', () => {
			const parentNode = {
				[nodeClassKey]: 'apex.jorje.data.ast.SomeNode',
				types: [],
			} as ApexNode & { types?: unknown[] };
			// Stack length 2: parent is at index 0
			const stack = [parentNode, {}];
			const path = createMockPath({} as ApexNode, undefined, stack);
			expect(isInTypeContext(path)).toBe(true);
		});

		it.concurrent(
			'should return false when parent class is undefined',
			() => {
				const parentNode = {} as ApexNode;
				const stack = [{}, parentNode];
				const path = createMockPath({} as ApexNode, undefined, stack);
				expect(isInTypeContext(path)).toBe(false);
			},
		);

		it.concurrent('should return false when stack is too short', () => {
			const stack: unknown[] = [];
			const path = createMockPath({} as ApexNode, undefined, stack);
			expect(isInTypeContext(path)).toBe(false);
		});
	});

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
				// This should reach line 208 (final return statement)
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
			'should handle names array with non-object primitive values',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				// Include non-object primitives to trigger line 178 continue statement
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

				// Should call print (primitive should be skipped via continue on line 178)
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
});
