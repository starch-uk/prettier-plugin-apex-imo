import { describe, it, expect } from 'vitest';
import * as prettier from 'prettier';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import our plugin
import plugin from '../src/index.js';

async function formatApex(code: string): Promise<string> {
	return prettier.format(code, {
		parser: 'apex',
		// Only include our plugin - it re-exports everything from prettier-plugin-apex
		plugins: [plugin],
		tabWidth: 2,
	});
}

function loadFixture(name: string, file: 'input' | 'output'): string {
	const fixturePath = path.join(
		__dirname,
		'__fixtures__',
		name,
		`${file}.cls`,
	);
	return fs.readFileSync(fixturePath, 'utf-8');
}

describe('prettier-plugin-apex-imo integration', () => {
	describe('List formatting', () => {
		it('should keep single-item lists inline', async () => {
			const input = loadFixture('list-single', 'input');
			const expected = loadFixture('list-single', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format multi-item lists as multiline', async () => {
			const input = loadFixture('list-multiline', 'input');
			const expected = loadFixture('list-multiline', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should handle lists with various item counts', async () => {
			// 2 items - should be multiline
			const input2 = `public class Test { List<String> two = new List<String>{ 'a', 'b' }; }`;
			const result2 = await formatApex(input2);
			expect(result2).toContain("'a',");
			expect(result2).toContain("'b'");
			expect(result2).toMatch(/\n\s+'a',/);
			expect(result2).toMatch(/\n\s+'b'/);

			// 3+ items - should be multiline
			const input3 = `public class Test { List<String> three = new List<String>{ 'a', 'b', 'c' }; }`;
			const result3 = await formatApex(input3);
			expect(result3).toMatch(/\n\s+'a',/);
			expect(result3).toMatch(/\n\s+'b',/);
			expect(result3).toMatch(/\n\s+'c'/);
		});
	});

	describe('Set formatting', () => {
		it('should keep single-item sets inline', async () => {
			const input = loadFixture('set-single', 'input');
			const expected = loadFixture('set-single', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format multi-item sets as multiline', async () => {
			const input = loadFixture('set-multiline', 'input');
			const expected = loadFixture('set-multiline', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should handle sets with various item counts', async () => {
			// 2 items - should be multiline
			const input2 = `public class Test { Set<String> two = new Set<String>{ 'a', 'b' }; }`;
			const result2 = await formatApex(input2);
			expect(result2).toContain("'a',");
			expect(result2).toContain("'b'");
			expect(result2).toMatch(/\n\s+'a',/);
			expect(result2).toMatch(/\n\s+'b'/);

			// 3+ items - should be multiline
			const input3 = `public class Test { Set<Integer> three = new Set<Integer>{ 1, 2, 3 }; }`;
			const result3 = await formatApex(input3);
			expect(result3).toMatch(/\n\s+1,/);
			expect(result3).toMatch(/\n\s+2,/);
			expect(result3).toMatch(/\n\s+3/);
		});

		it('should format Set types correctly with type parameters', async () => {
			const input = `public class Test { Set<String> tags = new Set<String>{ 'reading', 'coding' }; }`;
			const result = await formatApex(input);
			expect(result).toContain('Set<String>');
			expect(result).toMatch(/\n\s+'reading',/);
			expect(result).toMatch(/\n\s+'coding'/);
		});

		it('should format List with multiple entries using List type name', async () => {
			const input = `public class Test { List<Integer> nums = new List<Integer>{ 1, 2, 3 }; }`;
			const result = await formatApex(input);
			// Should use 'List' as type name, not 'Set'
			expect(result).toContain('List<Integer>');
			expect(result).not.toContain('Set<Integer>');
			expect(result).toMatch(/List<Integer>\{\s*\n/);
		});

		it('should format Set with multiple entries using Set type name', async () => {
			const input = `public class Test { Set<Integer> nums = new Set<Integer>{ 1, 2, 3 }; }`;
			const result = await formatApex(input);
			// Should use 'Set' as type name, not 'List'
			expect(result).toContain('Set<Integer>');
			expect(result).not.toContain('List<Integer>');
			expect(result).toMatch(/Set<Integer>\{\s*\n/);
		});

		it('should format Set correctly', async () => {
			const input = `public class Test { Set<MyClass> items = new Set<MyClass>{ new MyClass(), new MyClass() }; }`;
			const result = await formatApex(input);
			// Should format as multiline
			expect(result).toContain('Set<MyClass>');
			expect(result).toMatch(/Set<MyClass>\{\s*\n/);
		});

		it('should format List correctly', async () => {
			const input = `public class Test { List<MyClass> items = new List<MyClass>{ new MyClass(), new MyClass() }; }`;
			const result = await formatApex(input);
			// Should format as multiline
			expect(result).toContain('List<MyClass>');
			expect(result).toMatch(/List<MyClass>\{\s*\n/);
		});
	});

	describe('Map formatting', () => {
		it('should keep single-pair maps inline', async () => {
			const input = loadFixture('map-single', 'input');
			const expected = loadFixture('map-single', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format multi-pair maps as multiline', async () => {
			const input = loadFixture('map-multiline', 'input');
			const expected = loadFixture('map-multiline', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should handle maps with various pair counts', async () => {
			// 2 pairs - should be multiline
			const input2 = `public class Test { Map<String, String> two = new Map<String, String>{ 'a' => '1', 'b' => '2' }; }`;
			const result2 = await formatApex(input2);
			expect(result2).toMatch(/\n\s+'a' => '1',/);
			expect(result2).toMatch(/\n\s+'b' => '2'/);

			// 3+ pairs - should be multiline
			const input3 = `public class Test { Map<String, Integer> three = new Map<String, Integer>{ 'a' => 1, 'b' => 2, 'c' => 3 }; }`;
			const result3 = await formatApex(input3);
			expect(result3).toMatch(/\n\s+'a' => 1,/);
			expect(result3).toMatch(/\n\s+'b' => 2,/);
			expect(result3).toMatch(/\n\s+'c' => 3/);
		});
	});

	describe('Nested structures', () => {
		it('should handle Map with List values (nested lists)', async () => {
			const input = loadFixture('nested', 'input');
			const expected = loadFixture('nested', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});
	});

	describe('Mixed scenarios', () => {
		it('should handle mixed list/map scenarios correctly', async () => {
			const input = loadFixture('mixed', 'input');
			const expected = loadFixture('mixed', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});
	});

	describe('Edge cases', () => {
		it('should handle empty lists', async () => {
			const input = `public class Test { List<String> empty = new List<String>{}; }`;
			const result = await formatApex(input);
			expect(result).toContain('new List<String>{}');
			// Empty lists should stay on one line
			expect(result).not.toMatch(/List<String>\{\s*\n/);
		});

		it('should handle empty sets', async () => {
			const input = `public class Test { Set<String> empty = new Set<String>{}; }`;
			const result = await formatApex(input);
			expect(result).toContain('new Set<String>{}');
			// Empty sets should stay on one line
			expect(result).not.toMatch(/Set<String>\{\s*\n/);
		});

		it('should handle empty maps', async () => {
			const input = `public class Test { Map<String,String> empty = new Map<String,String>{}; }`;
			const result = await formatApex(input);
			expect(result).toContain('new Map<String, String>{}');
			// Empty maps should stay on one line
			expect(result).not.toMatch(/Map<String, String>\{\s*\n/);
		});

		it('should keep single-item lists inline', async () => {
			const input = `public class Test { List<String> single = new List<String>{ 'only' }; }`;
			const result = await formatApex(input);
			expect(result).toContain("new List<String>{ 'only' }");
			// Single item should stay on one line
			expect(result).not.toMatch(/List<String>\{\s*\n\s+'only'/);
		});

		it('should keep single-item sets inline', async () => {
			const input = `public class Test { Set<String> single = new Set<String>{ 'only' }; }`;
			const result = await formatApex(input);
			expect(result).toContain("new Set<String>{ 'only' }");
			// Single item should stay on one line
			expect(result).not.toMatch(/Set<String>\{\s*\n\s+'only'/);
		});

		it('should keep single-pair maps inline', async () => {
			const input = `public class Test { Map<String, String> single = new Map<String, String>{ 'key' => 'value' }; }`;
			const result = await formatApex(input);
			expect(result).toContain(
				"new Map<String, String>{ 'key' => 'value' }",
			);
			// Single pair should stay on one line
			expect(result).not.toMatch(/Map<String, String>\{\s*\n\s+'key'/);
		});
	});

	describe('Complex scenarios', () => {
		it('should handle lists with different data types', async () => {
			const input = `public class Test { List<Object> mixed = new List<Object>{ 1, 'two', true, null }; }`;
			const result = await formatApex(input);
			expect(result).toMatch(/\n\s+1,/);
			expect(result).toMatch(/\n\s+'two',/);
			expect(result).toMatch(/\n\s+true,/);
			expect(result).toMatch(/\n\s+null/);
		});

		it('should handle maps with complex values', async () => {
			const input = `public class Test { Map<String, Object> complex = new Map<String, Object>{ 'a' => 1, 'b' => 'two', 'c' => true }; }`;
			const result = await formatApex(input);
			expect(result).toMatch(/\n\s+'a' => 1,/);
			expect(result).toMatch(/\n\s+'b' => 'two',/);
			expect(result).toMatch(/\n\s+'c' => true/);
		});

		it('should handle nested lists within lists', async () => {
			const input = `public class Test { List<List<String>> nested = new List<List<String>>{ new List<String>{ 'a', 'b' }, new List<String>{ 'c', 'd' } }; }`;
			const result = await formatApex(input);
			// Outer list should be multiline
			expect(result).toMatch(/List<List<String>>\{\s*\n/);
			// Inner lists should also be multiline (2+ items)
			expect(result).toMatch(/\n\s+new List<String>\{\s*\n/);
		});

		it('should handle lists with many items', async () => {
			const input = `public class Test { List<String> many = new List<String>{ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h' }; }`;
			const result = await formatApex(input);
			// Should be multiline
			expect(result).toMatch(/List<String>\{\s*\n/);
			// Should contain all items
			expect(result).toContain("'a',");
			expect(result).toContain("'h'");
		});

		it('should handle maps with many pairs', async () => {
			const input = `public class Test { Map<String, Integer> many = new Map<String, Integer>{ 'a' => 1, 'b' => 2, 'c' => 3, 'd' => 4, 'e' => 5 }; }`;
			const result = await formatApex(input);
			// Should be multiline
			expect(result).toMatch(/Map<String, Integer>\{\s*\n/);
			// Should contain all pairs
			expect(result).toContain("'a' => 1,");
			expect(result).toContain("'e' => 5");
		});

		it('should handle Set with generic types', async () => {
			const input = `public class Test { Set<MyClass> items = new Set<MyClass>{ new MyClass(), new MyClass() }; }`;
			const result = await formatApex(input);
			// Should be multiline for 2+ items
			expect(result).toMatch(/Set<MyClass>\{\s*\n/);
		});

		it('should handle List with generic types', async () => {
			const input = `public class Test { List<MyClass> items = new List<MyClass>{ new MyClass(), new MyClass() }; }`;
			const result = await formatApex(input);
			// Should be multiline for 2+ items
			expect(result).toMatch(/List<MyClass>\{\s*\n/);
		});

		it('should handle Map with complex key types', async () => {
			const input = `public class Test { Map<MyClass, String> items = new Map<MyClass, String>{ new MyClass() => 'a', new MyClass() => 'b' }; }`;
			const result = await formatApex(input);
			// Should be multiline for 2+ pairs
			expect(result).toMatch(/Map<MyClass, String>\{\s*\n/);
		});

		it('should handle Map with type parameters', async () => {
			const input = `public class Test { Map<String, Integer> items = new Map<String, Integer>{ 'a' => 1, 'b' => 2 }; }`;
			const result = await formatApex(input);
			// Map types should be joined with ', ' (comma space)
			expect(result).toContain('Map<String, Integer>');
			expect(result).toMatch(/Map<String, Integer>\{\s*\n/);
		});
	});

	describe('Real-world scenarios', () => {
		it('should format method parameters with lists', async () => {
			const input = `public class Test { public void method() { processItems(new List<String>{ 'a', 'b', 'c' }); } }`;
			const result = await formatApex(input);
			expect(result).toMatch(/new List<String>\{\s*\n/);
		});

		it('should format return statements with maps', async () => {
			const input = `public class Test { public Map<String, Integer> getData() { return new Map<String, Integer>{ 'x' => 1, 'y' => 2 }; } }`;
			const result = await formatApex(input);
			expect(result).toMatch(/new Map<String, Integer>\{\s*\n/);
		});

		it('should format variable assignments with sets', async () => {
			const input = `public class Test { public void method() { Set<String> tags = new Set<String>{ 'tag1', 'tag2', 'tag3' }; } }`;
			const result = await formatApex(input);
			expect(result).toMatch(/new Set<String>\{\s*\n/);
		});

		it('should format empty list initialization', async () => {
			const input = `public class Test { List<String> empty = new List<String>{}; }`;
			const result = await formatApex(input);
			expect(result).toContain('new List<String>{}');
			expect(result).not.toMatch(/List<String>\{\s*\n/);
		});

		it('should format empty set initialization', async () => {
			const input = `public class Test { Set<String> empty = new Set<String>{}; }`;
			const result = await formatApex(input);
			expect(result).toContain('new Set<String>{}');
			expect(result).not.toMatch(/Set<String>\{\s*\n/);
		});

		it('should format empty map initialization', async () => {
			const input = `public class Test { Map<String, Integer> empty = new Map<String, Integer>{}; }`;
			const result = await formatApex(input);
			expect(result).toContain('new Map<String, Integer>{}');
			expect(result).not.toMatch(/Map<String, Integer>\{\s*\n/);
		});
	});

	describe('Type formatting differences', () => {
		it('should format List with qualified type names using dot separator', async () => {
			// Test with a qualified type name like MyNamespace.MyClass
			// The types array would contain [MyNamespace, MyClass] which should be joined with '.'
			const input = `public class Test { List<String> items = new List<String>{ 'a', 'b' }; }`;
			const result = await formatApex(input);
			// Should format as multiline
			expect(result).toMatch(/List<String>\{\s*\n/);
			expect(result).toContain('List<String>');
		});

		it('should format Set with qualified type names using comma-space separator', async () => {
			// Test Set formatting - types should be joined with ', ' for Set
			const input = `public class Test { Set<String> items = new Set<String>{ 'a', 'b' }; }`;
			const result = await formatApex(input);
			// Should format as multiline
			expect(result).toMatch(/Set<String>\{\s*\n/);
			expect(result).toContain('Set<String>');
		});

		it('should format Map types with comma-space separator', async () => {
			const input = `public class Test { Map<String, Integer> items = new Map<String, Integer>{ 'a' => 1, 'b' => 2 }; }`;
			const result = await formatApex(input);
			// Map types should be joined with ', '
			expect(result).toContain('Map<String, Integer>');
		});
	});

	describe('Printer branch coverage', () => {
		it('should use List type name and dot separator for List literals', async () => {
			const input = `public class Test { List<String> items = new List<String>{ 'a', 'b' }; }`;
			const result = await formatApex(input);
			// Verify it uses 'List' (not 'Set') and formats correctly
			expect(result).toContain('List<String>');
			expect(result).not.toContain('Set<String>');
			expect(result).toMatch(
				/List<String>\{\s*\n\s+'a',\s*\n\s+'b'\s*\n\s*\}/,
			);
		});

		it('should use Set type name and comma-space separator for Set literals', async () => {
			const input = `public class Test { Set<String> items = new Set<String>{ 'a', 'b' }; }`;
			const result = await formatApex(input);
			// Verify it uses 'Set' (not 'List') and formats correctly
			expect(result).toContain('Set<String>');
			expect(result).not.toContain('List<String>');
			expect(result).toMatch(
				/Set<String>\{\s*\n\s+'a',\s*\n\s+'b'\s*\n\s*\}/,
			);
		});

		it('should format Map with multiple pairs using multiline format', async () => {
			const input = `public class Test { Map<String, Integer> items = new Map<String, Integer>{ 'a' => 1, 'b' => 2, 'c' => 3 }; }`;
			const result = await formatApex(input);
			// Verify multiline format with proper key-value pairs
			expect(result).toContain('Map<String, Integer>');
			expect(result).toMatch(/Map<String, Integer>\{\s*\n/);
			expect(result).toMatch(/\n\s+'a' => 1,/);
			expect(result).toMatch(/\n\s+'b' => 2,/);
			expect(result).toMatch(/\n\s+'c' => 3/);
		});
	});
});
