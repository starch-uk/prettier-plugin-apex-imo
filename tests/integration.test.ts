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
});
