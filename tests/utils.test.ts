/**
 * @file Unit tests for the utils module.
 */

import { describe, it, expect } from 'vitest';
import {
	calculateEffectiveWidth,
	isEmpty,
	isNotEmpty,
	isObject,
	isApexNodeLike,
	preserveBlankLineAfterClosingBrace,
	startsWithAccessModifier,
	getNodeClass,
	getNodeClassOptional,
	createNodeClassGuard,
} from '../src/utils.js';
import type { ApexNode } from '../src/types.js';

describe('utils', () => {
	describe('isEmpty and isNotEmpty', () => {
		it.concurrent.each([
			{ expectedEmpty: true, value: '' },
			{ expectedEmpty: true, value: [] },
			{ expectedEmpty: false, value: 'test' },
			{ expectedEmpty: false, value: [1, 2, 3] },
		])(
			'isEmpty($value) returns $expectedEmpty and isNotEmpty($value) returns opposite',
			({
				expectedEmpty,
				value,
			}: Readonly<{
				expectedEmpty: boolean;
				value: string | readonly unknown[];
			}>) => {
				expect(isEmpty(value)).toBe(expectedEmpty);
				expect(isNotEmpty(value)).toBe(!expectedEmpty);
			},
		);
	});

	describe('isObject', () => {
		it.concurrent.each([
			{ expected: true, value: {} },
			{ expected: true, value: { key: 'value' } },
			{ expected: true, value: [] },
			{ expected: false, value: null },
			{ expected: false, value: 'string' },
			{ expected: false, value: 123 },
			{ expected: false, value: true },
			{ expected: false, value: undefined },
		])(
			'should return $expected for $value',
			({
				expected,
				value,
			}: Readonly<{
				expected: boolean;
				value: unknown;
			}>) => {
				expect(isObject(value)).toBe(expected);
			},
		);
	});

	describe('isApexNodeLike', () => {
		it.concurrent(
			'should return true for objects with @class property',
			() => {
				expect(isApexNodeLike({ '@class': 'test' })).toBe(true);
				expect(isApexNodeLike({ '@class': 'Test', key: 'value' })).toBe(
					true,
				);
			},
		);

		it.concurrent(
			'should return false for objects without @class property',
			() => {
				expect(isApexNodeLike({})).toBe(false);
				expect(isApexNodeLike({ key: 'value' })).toBe(false);
			},
		);

		it.concurrent('should return false for non-objects', () => {
			expect(isApexNodeLike(null)).toBe(false);
			expect(isApexNodeLike('string')).toBe(false);
			expect(isApexNodeLike(123)).toBe(false);
		});
	});

	describe('getNodeClass', () => {
		it.concurrent('should return @class value from node', () => {
			const node: ApexNode = {
				'@class': 'apex.jorje.data.ast.Identifier',
			} as ApexNode;
			expect(getNodeClass(node)).toBe('apex.jorje.data.ast.Identifier');
		});
	});

	describe('getNodeClassOptional', () => {
		it.concurrent('should return @class value when it is a string', () => {
			const node: ApexNode = {
				'@class': 'apex.jorje.data.ast.Identifier',
			} as ApexNode;
			expect(getNodeClassOptional(node)).toBe(
				'apex.jorje.data.ast.Identifier',
			);
		});

		it.concurrent.each([
			{
				description:
					'should return undefined when @class is not a string',
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Testing invalid @class type
				node: { '@class': 123 } as unknown as ApexNode,
			},
			{
				description: 'should return undefined when @class is missing',
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Testing node without @class property
				node: {} as ApexNode,
			},
		])(
			'$description',
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- it.each provides readonly data
			({
				node,
			}: Readonly<{
				description: string;
				node: ApexNode;
			}>) => {
				expect(getNodeClassOptional(node)).toBeUndefined();
			},
		);
	});

	describe('createNodeClassGuard', () => {
		it.concurrent(
			'should return true when node class matches string',
			() => {
				const guard = createNodeClassGuard<ApexNode>('test.Class');
				const node = { '@class': 'test.Class' } as ApexNode;
				expect(guard(node)).toBe(true);
			},
		);

		it.concurrent(
			'should return false when node class does not match',
			() => {
				const guard = createNodeClassGuard<ApexNode>('test.Class');
				const node = { '@class': 'other.Class' } as ApexNode;
				expect(guard(node)).toBe(false);
			},
		);

		it.concurrent(
			'should return true when function check returns true',
			() => {
				const guard = createNodeClassGuard<ApexNode>(
					(cls) => cls?.includes('Test') ?? false,
				);
				const node = { '@class': 'test.TestClass' } as ApexNode;
				expect(guard(node)).toBe(true);
			},
		);

		it.concurrent.each([
			{ description: 'should return false for null', value: null },
			{
				description: 'should return false for undefined',
				value: undefined,
			},
		])(
			'$description',
			({
				value,
			}: Readonly<{
				description: string;
				value: null | undefined;
			}>) => {
				const guard = createNodeClassGuard<ApexNode>('test.Class');
				expect(guard(value)).toBe(false);
			},
		);
	});

	describe('startsWithAccessModifier', () => {
		it.concurrent.each([
			{
				description: 'public modifier',
				expected: true,
				text: 'public String name',
			},
			{
				description: 'PUBLIC modifier (uppercase)',
				expected: true,
				text: 'PUBLIC String name',
			},
			{
				description: 'private modifier',
				expected: true,
				text: 'private Integer count',
			},
			{
				description: 'protected modifier',
				expected: true,
				text: 'protected String name',
			},
			{
				description: 'static modifier',
				expected: true,
				text: 'static final Integer count',
			},
			{
				description: 'global modifier',
				expected: true,
				text: 'global Account account',
			},
		])(
			'should return $expected for $description',
			({
				expected,
				text,
			}: Readonly<{
				description: string;
				expected: boolean;
				text: string;
			}>) => {
				expect(startsWithAccessModifier(text)).toBe(expected);
			},
		);

		it.concurrent.each([
			{ description: 'non-modifier words', text: 'String name' },
			{
				description: 'non-modifier words (Integer)',
				text: 'Integer count',
			},
			{ description: 'empty string', text: '' },
			{ description: 'whitespace-only string', text: '   ' },
		])(
			'should return false for $description',
			({
				text,
			}: Readonly<{
				description: string;
				text: string;
			}>) => {
				expect(startsWithAccessModifier(text)).toBe(false);
			},
		);
	});

	describe('calculateEffectiveWidth', () => {
		it.concurrent('should calculate effective width correctly', () => {
			expect(calculateEffectiveWidth(100, 10)).toBe(90);
			expect(calculateEffectiveWidth(80, 5)).toBe(75);
			expect(calculateEffectiveWidth(120, 0)).toBe(120);
		});

		it.concurrent('should throw error when printWidth is undefined', () => {
			expect(() => {
				calculateEffectiveWidth(undefined, 10);
			}).toThrow(
				'prettier-plugin-apex-imo: printWidth is required for calculateEffectiveWidth',
			);
		});
	});

	describe('preserveBlankLineAfterClosingBrace', () => {
		it.concurrent.each([
			{
				description: 'should return true when next line starts with @',
				expected: true,
				index: 0,
				lines: ['  }', '  @Test'],
			},
			{
				description:
					'should return true when next line starts with public',
				expected: true,
				index: 0,
				lines: ['  }', '  public void method() {}'],
			},
			{
				description:
					'should return true when next line starts with private',
				expected: true,
				index: 0,
				lines: ['  }', '  private Integer count;'],
			},
			{
				description:
					'should return true when next line starts with static',
				expected: true,
				index: 0,
				lines: ['  }', '  static final Integer count;'],
			},
			{
				description:
					'should return false when line does not end with }',
				expected: false,
				index: 0,
				lines: ['  );', '  @Test'],
			},
			{
				description: 'should return false when next line is empty',
				expected: false,
				index: 0,
				lines: ['  }', ''],
			},
			{
				description:
					'should return false when next line starts with non-modifier',
				expected: false,
				index: 0,
				lines: ['  }', '  String name;'],
			},
			{
				description:
					'should return false when next line is whitespace-only',
				expected: false,
				index: 0,
				lines: ['  }', '   '],
			},
			{
				description:
					'should return false when index is out of bounds (last line)',
				expected: false,
				index: 0,
				lines: ['  }'],
			},
			{
				description:
					'should return false when index is out of bounds (negative)',
				expected: false,
				index: -1,
				lines: ['  }'],
			},
			{
				description:
					'should return false when index is out of bounds (too large)',
				expected: false,
				index: 10,
				lines: ['  }'],
			},
			{
				description:
					'should return false when current line is undefined (empty array)',
				expected: false,
				index: 0,
				lines: [],
			},
			{
				description:
					'should return false when current line is undefined (sparse array)',
				expected: false,
				index: 1,
				lines: ((): readonly string[] => {
					// Create sparse array where index 0 exists but index 1 is undefined
					const sparseLines: (string | undefined)[] = ['  }'];
					sparseLines[2] = '  @Test'; // Skip index 1
					// Access with index 1 which is undefined
					// This tests line 137: if (currentLine === undefined) return false;
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Testing sparse array with undefined elements
					return sparseLines as readonly string[];
				})(),
			},
		])(
			'$description',
			({
				description: _description,
				expected,
				index,
				lines,
			}: Readonly<{
				description: string;
				expected: boolean;
				index: number;
				lines: readonly string[];
			}>) => {
				expect(preserveBlankLineAfterClosingBrace(lines, index)).toBe(
					expected,
				);
			},
		);
	});
});
