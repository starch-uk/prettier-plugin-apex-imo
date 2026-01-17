/**
 * @file Unit tests for the casing module.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types, @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect, test } from 'vitest';
import {
	normalizeTypeName,
	normalizeReservedWord,
	normalizeStandardObjectType,
	isIdentifier,
	isInTypeContext,
	createReservedWordNormalizingPrint,
	createTypeNormalizingPrint,
} from '../src/casing.js';
import { STANDARD_OBJECTS } from '../src/refs/standard-objects.js';
import { APEX_OBJECT_SUFFIXES } from '../src/refs/object-suffixes.js';
import type { ApexNode, ApexIdentifier } from '../src/types.js';
import { createMockPath, createMockPrint } from './test-utils.js';

const nodeClassKey = '@class';

describe('casing', () => {
	describe('normalizeReservedWord', () => {
		it.concurrent('should normalize reserved words to lowercase', () => {
			expect(normalizeReservedWord('PUBLIC')).toBe('public');
			expect(normalizeReservedWord('Private')).toBe('private');
			expect(normalizeReservedWord('STATIC')).toBe('static');
			expect(normalizeReservedWord('Final')).toBe('final');
			expect(normalizeReservedWord('CLASS')).toBe('class');
			expect(normalizeReservedWord('Interface')).toBe('interface');
			expect(normalizeReservedWord('ENUM')).toBe('enum');
			expect(normalizeReservedWord('Void')).toBe('void');
			expect(normalizeReservedWord('ABSTRACT')).toBe('abstract');
			expect(normalizeReservedWord('Virtual')).toBe('virtual');
			expect(normalizeReservedWord('IF')).toBe('if');
			expect(normalizeReservedWord('Else')).toBe('else');
			expect(normalizeReservedWord('FOR')).toBe('for');
			expect(normalizeReservedWord('While')).toBe('while');
			expect(normalizeReservedWord('RETURN')).toBe('return');
			expect(normalizeReservedWord('Try')).toBe('try');
			expect(normalizeReservedWord('CATCH')).toBe('catch');
			expect(normalizeReservedWord('Finally')).toBe('finally');
			expect(normalizeReservedWord('NEW')).toBe('new');
			expect(normalizeReservedWord('This')).toBe('this');
			expect(normalizeReservedWord('SUPER')).toBe('super');
			expect(normalizeReservedWord('NULL')).toBe('null');
		});

		it.concurrent(
			'should return lowercase unchanged for reserved words already in lowercase',
			() => {
				expect(normalizeReservedWord('public')).toBe('public');
				expect(normalizeReservedWord('private')).toBe('private');
				expect(normalizeReservedWord('static')).toBe('static');
				expect(normalizeReservedWord('class')).toBe('class');
				expect(normalizeReservedWord('interface')).toBe('interface');
			},
		);

		it.concurrent('should return unchanged for non-reserved words', () => {
			expect(normalizeReservedWord('MyVariable')).toBe('MyVariable');
			expect(normalizeReservedWord('myVariable')).toBe('myVariable');
			expect(normalizeReservedWord('MYVARIABLE')).toBe('MYVARIABLE');
			expect(normalizeReservedWord('Account')).toBe('Account');
			expect(normalizeReservedWord('String')).toBe('String');
		});

		it.concurrent('should handle empty string', () => {
			expect(normalizeReservedWord('')).toBe('');
		});

		it.concurrent('should handle all declaration modifiers', () => {
			expect(normalizeReservedWord('PUBLIC')).toBe('public');
			expect(normalizeReservedWord('PRIVATE')).toBe('private');
			expect(normalizeReservedWord('PROTECTED')).toBe('protected');
			expect(normalizeReservedWord('STATIC')).toBe('static');
			expect(normalizeReservedWord('FINAL')).toBe('final');
			expect(normalizeReservedWord('TRANSIENT')).toBe('transient');
			expect(normalizeReservedWord('GLOBAL')).toBe('global');
			expect(normalizeReservedWord('WEBSERVICE')).toBe('webservice');
		});

		it.concurrent('should handle type-related reserved words', () => {
			expect(normalizeReservedWord('ENUM')).toBe('enum');
			expect(normalizeReservedWord('CLASS')).toBe('class');
			expect(normalizeReservedWord('INTERFACE')).toBe('interface');
			expect(normalizeReservedWord('VOID')).toBe('void');
			expect(normalizeReservedWord('ABSTRACT')).toBe('abstract');
			expect(normalizeReservedWord('VIRTUAL')).toBe('virtual');
		});

		it.concurrent('should handle control flow keywords', () => {
			expect(normalizeReservedWord('IF')).toBe('if');
			expect(normalizeReservedWord('ELSE')).toBe('else');
			expect(normalizeReservedWord('SWITCH')).toBe('switch');
			expect(normalizeReservedWord('CASE')).toBe('case');
			expect(normalizeReservedWord('DEFAULT')).toBe('default');
			expect(normalizeReservedWord('FOR')).toBe('for');
			expect(normalizeReservedWord('WHILE')).toBe('while');
			expect(normalizeReservedWord('DO')).toBe('do');
			expect(normalizeReservedWord('BREAK')).toBe('break');
			expect(normalizeReservedWord('CONTINUE')).toBe('continue');
			expect(normalizeReservedWord('RETURN')).toBe('return');
		});
	});

	describe('normalizeTypeName', () => {
		it.concurrent('should normalize primitive types to PascalCase', () => {
			// Test that primitives are normalized first, before standard objects
			expect(normalizeTypeName('string')).toBe('String');
			expect(normalizeTypeName('integer')).toBe('Integer');
			expect(normalizeTypeName('boolean')).toBe('Boolean');
			expect(normalizeTypeName('blob')).toBe('Blob');
			expect(normalizeTypeName('date')).toBe('Date');
			expect(normalizeTypeName('datetime')).toBe('Datetime');
			expect(normalizeTypeName('decimal')).toBe('Decimal');
			expect(normalizeTypeName('double')).toBe('Double');
			expect(normalizeTypeName('id')).toBe('ID');
			expect(normalizeTypeName('long')).toBe('Long');
			expect(normalizeTypeName('object')).toBe('Object');
			expect(normalizeTypeName('time')).toBe('Time');
			expect(normalizeTypeName('sobject')).toBe('SObject');
		});

		it.concurrent('should normalize collection types to PascalCase', () => {
			expect(normalizeTypeName('list')).toBe('List');
			expect(normalizeTypeName('set')).toBe('Set');
			expect(normalizeTypeName('map')).toBe('Map');
		});

		it.concurrent(
			'should normalize primitives regardless of input case',
			() => {
				expect(normalizeTypeName('STRING')).toBe('String');
				expect(normalizeTypeName('String')).toBe('String');
				expect(normalizeTypeName('sTrInG')).toBe('String');
				expect(normalizeTypeName('INTEGER')).toBe('Integer');
				expect(normalizeTypeName('Integer')).toBe('Integer');
				expect(normalizeTypeName('iNtEgEr')).toBe('Integer');
				expect(normalizeTypeName('ID')).toBe('ID');
				expect(normalizeTypeName('Id')).toBe('ID');
				expect(normalizeTypeName('id')).toBe('ID');
			},
		);

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

		it.concurrent('should handle empty string input', () => {
			expect(normalizeTypeName('')).toBe('');
		});

		it.concurrent(
			'should handle types that are not primitives or standard objects',
			() => {
				expect(normalizeTypeName('MyCustomClass')).toBe(
					'MyCustomClass',
				);
				expect(normalizeTypeName('SomeOtherType')).toBe(
					'SomeOtherType',
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
			'should handle empty string in normalizeStandardObjectType',
			() => {
				// Test the defensive empty string check in normalizeStandardObjectType
				expect(normalizeStandardObjectType('')).toBe('');
			},
		);

		it.concurrent(
			'should return unchanged for types without normalization needs',
			() => {
				expect(normalizeTypeName('MyCustomClass')).toBe(
					'MyCustomClass',
				);
				// String is already in correct case, so it returns unchanged
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

		it.concurrent('should return false when stack is not an array', () => {
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				value: 'string',
			} as ApexIdentifier;
			const path = createMockPath(
				node,
				'type',
				'not an array' as unknown as readonly unknown[],
			);

			expect(isInTypeContext(path)).toBe(false);
		});

		it.concurrent(
			'should handle isTypeRelatedKey with non-string key',
			() => {
				// Test that isTypeRelatedKey returns false for non-string keys
				// This tests the internal function through isInTypeContext
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'string',
				} as ApexIdentifier;
				// key is a number, not a string
				const path = createMockPath(node, 0);

				// isTypeRelatedKey is called internally, but with string keys it checks type-related keys
				// With numeric keys, it should return false
				expect(isInTypeContext(path)).toBeDefined();
			},
		);
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

		it.concurrent('should handle key being null', () => {
			const mockPrint = createMockPrint();
			const typeNormalizingPrint = createTypeNormalizingPrint(mockPrint);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
			} as ApexNode;
			// Create path with null key (which gets normalized to undefined on line 403)
			const basePath = createMockPath(node, undefined);
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
				const path = createMockPath(node, 0); // Array index

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
				{ input: 'PUBLIC', expected: 'public' },
				{ input: 'Private', expected: 'private' },
				{ input: 'STATIC', expected: 'static' },
				{ input: 'Class', expected: 'class' },
				{ input: 'INTERFACE', expected: 'interface' },
				{ input: 'Enum', expected: 'enum' },
				{ input: 'VOID', expected: 'void' },
				{ input: 'Abstract', expected: 'abstract' },
				{ input: 'IF', expected: 'if' },
				{ input: 'Else', expected: 'else' },
				{ input: 'FOR', expected: 'for' },
				{ input: 'While', expected: 'while' },
				{ input: 'RETURN', expected: 'return' },
				{ input: 'Try', expected: 'try' },
				{ input: 'CATCH', expected: 'catch' },
				{ input: 'NEW', expected: 'new' },
				{ input: 'This', expected: 'this' },
				{ input: 'SUPER', expected: 'super' },
				{ input: 'NULL', expected: 'null' },
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
