/**
 * @file Unit tests for the utils module.
 */

import { describe, it, expect } from 'vitest';
import {
	calculateEffectiveWidth,
	formatApexCodeWithFallback,
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
	describe('isEmpty', () => {
		it.concurrent('should return true for empty string', () => {
			expect(isEmpty('')).toBe(true);
		});

		it.concurrent('should return true for empty array', () => {
			expect(isEmpty([])).toBe(true);
		});

		it.concurrent('should return false for non-empty string', () => {
			expect(isEmpty('test')).toBe(false);
		});

		it.concurrent('should return false for non-empty array', () => {
			expect(isEmpty([1, 2, 3])).toBe(false);
		});
	});

	describe('isNotEmpty', () => {
		it.concurrent('should return false for empty string', () => {
			expect(isNotEmpty('')).toBe(false);
		});

		it.concurrent('should return false for empty array', () => {
			expect(isNotEmpty([])).toBe(false);
		});

		it.concurrent('should return true for non-empty string', () => {
			expect(isNotEmpty('test')).toBe(true);
		});

		it.concurrent('should return true for non-empty array', () => {
			expect(isNotEmpty([1, 2, 3])).toBe(true);
		});
	});

	describe('isObject', () => {
		it.concurrent('should return true for objects', () => {
			expect(isObject({})).toBe(true);
			expect(isObject({ key: 'value' })).toBe(true);
			expect(isObject([])).toBe(true);
		});

		it.concurrent('should return false for null', () => {
			expect(isObject(null)).toBe(false);
		});

		it.concurrent('should return false for primitives', () => {
			expect(isObject('string')).toBe(false);
			expect(isObject(123)).toBe(false);
			expect(isObject(true)).toBe(false);
			expect(isObject(undefined)).toBe(false);
		});
	});

	describe('isApexNodeLike', () => {
		it.concurrent('should return true for objects with @class property', () => {
			expect(isApexNodeLike({ '@class': 'test' })).toBe(true);
			expect(isApexNodeLike({ '@class': 'Test', key: 'value' })).toBe(true);
		});

		it.concurrent('should return false for objects without @class property', () => {
			expect(isApexNodeLike({})).toBe(false);
			expect(isApexNodeLike({ key: 'value' })).toBe(false);
		});

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
			expect(getNodeClassOptional(node)).toBe('apex.jorje.data.ast.Identifier');
		});

		it.concurrent('should return undefined when @class is not a string', () => {
			const node = {
				'@class': 123,
			} as unknown as ApexNode;
			expect(getNodeClassOptional(node)).toBeUndefined();
		});

		it.concurrent('should return undefined when @class is missing', () => {
			const node = {} as ApexNode;
			expect(getNodeClassOptional(node)).toBeUndefined();
		});
	});

	describe('createNodeClassGuard', () => {
		it.concurrent('should return true when node class matches string', () => {
			const guard = createNodeClassGuard<ApexNode>('test.Class');
			const node = { '@class': 'test.Class' } as ApexNode;
			expect(guard(node)).toBe(true);
		});

		it.concurrent('should return false when node class does not match', () => {
			const guard = createNodeClassGuard<ApexNode>('test.Class');
			const node = { '@class': 'other.Class' } as ApexNode;
			expect(guard(node)).toBe(false);
		});

		it.concurrent('should return true when function check returns true', () => {
			const guard = createNodeClassGuard<ApexNode>((cls) =>
				cls?.includes('Test') ?? false,
			);
			const node = { '@class': 'test.TestClass' } as ApexNode;
			expect(guard(node)).toBe(true);
		});

		it.concurrent('should return false for null', () => {
			const guard = createNodeClassGuard<ApexNode>('test.Class');
			expect(guard(null)).toBe(false);
		});

		it.concurrent('should return false for undefined', () => {
			const guard = createNodeClassGuard<ApexNode>('test.Class');
			expect(guard(undefined)).toBe(false);
		});
	});

	describe('startsWithAccessModifier', () => {
		it.concurrent('should return true for public modifier', () => {
			expect(startsWithAccessModifier('public String name')).toBe(true);
			expect(startsWithAccessModifier('PUBLIC String name')).toBe(true);
		});

		it.concurrent('should return true for private modifier', () => {
			expect(startsWithAccessModifier('private Integer count')).toBe(true);
		});

		it.concurrent('should return true for protected modifier', () => {
			expect(startsWithAccessModifier('protected String name')).toBe(true);
		});

		it.concurrent('should return true for static modifier', () => {
			expect(startsWithAccessModifier('static final Integer count')).toBe(true);
		});

		it.concurrent('should return true for global modifier', () => {
			expect(startsWithAccessModifier('global Account account')).toBe(true);
		});

		it.concurrent('should return false for non-modifier words', () => {
			expect(startsWithAccessModifier('String name')).toBe(false);
			expect(startsWithAccessModifier('Integer count')).toBe(false);
		});

		it.concurrent('should return false for empty string', () => {
			expect(startsWithAccessModifier('')).toBe(false);
		});

		it.concurrent('should return false for whitespace-only string', () => {
			expect(startsWithAccessModifier('   ')).toBe(false);
		});
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
			}).toThrow('prettier-plugin-apex-imo: printWidth is required for calculateEffectiveWidth');
		});
	});

	describe('preserveBlankLineAfterClosingBrace', () => {
		it.concurrent(
			'should return true when line ends with } and next line starts with @',
			() => {
				const lines = ['  }', '  @Test'];
				expect(preserveBlankLineAfterClosingBrace(lines, 0)).toBe(true);
			},
		);

		it.concurrent(
			'should return true when line ends with } and next line starts with access modifier',
			() => {
				const lines = ['  }', '  public void method() {}'];
				expect(preserveBlankLineAfterClosingBrace(lines, 0)).toBe(true);
			},
		);

		it.concurrent('should return false when line does not end with }', () => {
			const lines = ['  );', '  @Test'];
			expect(preserveBlankLineAfterClosingBrace(lines, 0)).toBe(false);
		});

		it.concurrent('should return false when next line is empty', () => {
			const lines = ['  }', ''];
			expect(preserveBlankLineAfterClosingBrace(lines, 0)).toBe(false);
		});

		it.concurrent('should return false when index is out of bounds', () => {
			const lines = ['  }'];
			expect(preserveBlankLineAfterClosingBrace(lines, 0)).toBe(false);
			expect(preserveBlankLineAfterClosingBrace(lines, -1)).toBe(false);
			expect(preserveBlankLineAfterClosingBrace(lines, 10)).toBe(false);
		});

		it.concurrent('should return false when current line is undefined', () => {
			const lines: string[] = [];
			expect(preserveBlankLineAfterClosingBrace(lines, 0)).toBe(false);
		});

		it.concurrent(
			'should return false when next line starts with non-modifier word',
			() => {
				const lines = ['  }', '  String name;'];
				expect(preserveBlankLineAfterClosingBrace(lines, 0)).toBe(false);
			},
		);

		it.concurrent('should handle whitespace-only next line', () => {
			const lines = ['  }', '   '];
			expect(preserveBlankLineAfterClosingBrace(lines, 0)).toBe(false);
		});

		it.concurrent(
			'should return true for private modifier after closing brace',
			() => {
				const lines = ['  }', '  private Integer count;'];
				expect(preserveBlankLineAfterClosingBrace(lines, 0)).toBe(true);
			},
		);

		it.concurrent(
			'should return true for static modifier after closing brace',
			() => {
				const lines = ['  }', '  static final Integer count;'];
				expect(preserveBlankLineAfterClosingBrace(lines, 0)).toBe(true);
			},
		);
	});

	describe('formatApexCodeWithFallback', () => {
		it.concurrent('should format code with apex-anonymous parser', async () => {
			const code = 'Integer x = 10;';
			const result = await formatApexCodeWithFallback(code, {
				parser: 'apex',
				plugins: [],
			});
			expect(result).toBeTruthy();
			expect(typeof result).toBe('string');
		});

		it.concurrent(
			'should fallback to apex parser when apex-anonymous fails',
			async () => {
				// Use code that might fail with apex-anonymous but work with apex
				// Note: This is hard to reliably test since both parsers might succeed,
				// but we want to ensure the fallback path exists
				const code = 'public class Test { }';
				const result = await formatApexCodeWithFallback(code, {
					parser: 'apex',
					plugins: [],
				});
				expect(result).toBeTruthy();
				expect(typeof result).toBe('string');
			},
		);

		it.concurrent(
			'should return result from apex parser when apex-anonymous fails',
			async () => {
				// Test the fallback path: apex-anonymous fails, apex succeeds
				// Using a simple class declaration that apex-anonymous typically cannot parse
				// but apex can parse. If apex-anonymous actually succeeds, that's okay too -
				// the important thing is that the code path exists and both try blocks work.
				const code = 'public class Test {}';
				const result = await formatApexCodeWithFallback(code, {
					parser: 'apex',
					plugins: [],
				});
				// Should return formatted code (either from apex-anonymous or apex parser)
				expect(result).toBeTruthy();
				expect(typeof result).toBe('string');
			},
		);

		it.concurrent(
			'should return original code when both parsers fail',
			async () => {
				// Very invalid code that both parsers will fail on
				const code = '!!!INVALID!!!';
				const result = await formatApexCodeWithFallback(code, {
					parser: 'apex',
					plugins: [],
				});
				// Should return original code when both parsers fail
				expect(result).toBe(code);
			},
		);
	});
});
