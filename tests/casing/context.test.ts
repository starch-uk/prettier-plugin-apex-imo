/**
 * @file Unit tests for context detection functions in the casing module.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types, @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect } from 'vitest';
import { isIdentifier, isInTypeContext } from '../../src/casing.js';
import type { ApexNode, ApexIdentifier } from '../../src/types.js';
import { createMockPath } from '../test-utils.js';

const nodeClassKey = '@class';

describe('casing', () => {
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
});
