import { describe, it, expect } from 'vitest';
import * as prettier from 'prettier';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

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
		testDirectory,
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
			const input2 = loadFixture('list-two-items', 'input');
			const expected2 = loadFixture('list-two-items', 'output');
			const result2 = await formatApex(input2);
			expect(result2).toBe(expected2);

			// 3+ items - should be multiline
			const input3 = loadFixture('list-three-items', 'input');
			const expected3 = loadFixture('list-three-items', 'output');
			const result3 = await formatApex(input3);
			expect(result3).toBe(expected3);
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
			const input2 = loadFixture('set-two-items', 'input');
			const expected2 = loadFixture('set-two-items', 'output');
			const result2 = await formatApex(input2);
			expect(result2).toBe(expected2);

			// 3+ items - should be multiline
			const input3 = loadFixture('set-three-items', 'input');
			const expected3 = loadFixture('set-three-items', 'output');
			const result3 = await formatApex(input3);
			expect(result3).toBe(expected3);
		});

		it('should format Set types correctly with type parameters', async () => {
			const input = loadFixture('set-type-parameters', 'input');
			const expected = loadFixture('set-type-parameters', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format List with multiple entries using List type name', async () => {
			const input = loadFixture('list-multiple-entries', 'input');
			const expected = loadFixture('list-multiple-entries', 'output');
			const result = await formatApex(input);
			// Should use 'List' as type name, not 'Set'
			expect(result).toBe(expected);
		});

		it('should format Set with multiple entries using Set type name', async () => {
			const input = loadFixture('set-multiple-entries', 'input');
			const expected = loadFixture('set-multiple-entries', 'output');
			const result = await formatApex(input);
			// Should use 'Set' as type name, not 'List'
			expect(result).toBe(expected);
		});

		it('should format Set correctly', async () => {
			const input = loadFixture('set-generic-types', 'input');
			const expected = loadFixture('set-generic-types', 'output');
			const result = await formatApex(input);
			// Should format as multiline
			expect(result).toBe(expected);
		});

		it('should format List correctly', async () => {
			const input = loadFixture('list-generic-types', 'input');
			const expected = loadFixture('list-generic-types', 'output');
			const result = await formatApex(input);
			// Should format as multiline
			expect(result).toBe(expected);
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
			const input2 = loadFixture('map-two-pairs', 'input');
			const expected2 = loadFixture('map-two-pairs', 'output');
			const result2 = await formatApex(input2);
			expect(result2).toBe(expected2);

			// 3+ pairs - should be multiline
			const input3 = loadFixture('map-three-pairs', 'input');
			const expected3 = loadFixture('map-three-pairs', 'output');
			const result3 = await formatApex(input3);
			expect(result3).toBe(expected3);
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
			const input = loadFixture('list-empty', 'input');
			const expected = loadFixture('list-empty', 'output');
			const result = await formatApex(input);
			// Empty lists should stay on one line
			expect(result).toBe(expected);
		});

		it('should handle empty sets', async () => {
			const input = loadFixture('set-empty', 'input');
			const expected = loadFixture('set-empty', 'output');
			const result = await formatApex(input);
			// Empty sets should stay on one line
			expect(result).toBe(expected);
		});

		it('should handle empty maps', async () => {
			const input = loadFixture('map-empty', 'input');
			const expected = loadFixture('map-empty', 'output');
			const result = await formatApex(input);
			// Empty maps should stay on one line
			expect(result).toBe(expected);
		});

		it('should keep single-item lists inline', async () => {
			const input = loadFixture('list-single-item', 'input');
			const expected = loadFixture('list-single-item', 'output');
			const result = await formatApex(input);
			// Single item should stay on one line
			expect(result).toBe(expected);
		});

		it('should keep single-item sets inline', async () => {
			const input = loadFixture('set-single-item', 'input');
			const expected = loadFixture('set-single-item', 'output');
			const result = await formatApex(input);
			// Single item should stay on one line
			expect(result).toBe(expected);
		});

		it('should keep single-pair maps inline', async () => {
			const input = loadFixture('map-single-pair', 'input');
			const expected = loadFixture('map-single-pair', 'output');
			const result = await formatApex(input);
			// Single pair should stay on one line
			expect(result).toBe(expected);
		});
	});

	describe('Complex scenarios', () => {
		it('should handle lists with different data types', async () => {
			const input = loadFixture('list-mixed-types', 'input');
			const expected = loadFixture('list-mixed-types', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should handle maps with complex values', async () => {
			const input = loadFixture('map-complex-values', 'input');
			const expected = loadFixture('map-complex-values', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should handle nested lists within lists', async () => {
			const input = loadFixture('list-nested', 'input');
			const expected = loadFixture('list-nested', 'output');
			const result = await formatApex(input);
			// Outer list should be multiline
			// Inner lists should also be multiline (2+ items)
			expect(result).toBe(expected);
		});

		it('should handle lists with many items', async () => {
			const input = loadFixture('list-many-items', 'input');
			const expected = loadFixture('list-many-items', 'output');
			const result = await formatApex(input);
			// Should be multiline
			// Should contain all items
			expect(result).toBe(expected);
		});

		it('should handle maps with many pairs', async () => {
			const input = loadFixture('map-many-pairs', 'input');
			const expected = loadFixture('map-many-pairs', 'output');
			const result = await formatApex(input);
			// Should be multiline
			// Should contain all pairs
			expect(result).toBe(expected);
		});

		it('should handle Set with generic types', async () => {
			const input = loadFixture('set-generic-types', 'input');
			const expected = loadFixture('set-generic-types', 'output');
			const result = await formatApex(input);
			// Should be multiline for 2+ items
			expect(result).toBe(expected);
		});

		it('should handle List with generic types', async () => {
			const input = loadFixture('list-generic-types', 'input');
			const expected = loadFixture('list-generic-types', 'output');
			const result = await formatApex(input);
			// Should be multiline for 2+ items
			expect(result).toBe(expected);
		});

		it('should handle Map with complex key types', async () => {
			const input = loadFixture('map-complex-keys', 'input');
			const expected = loadFixture('map-complex-keys', 'output');
			const result = await formatApex(input);
			// Should be multiline for 2+ pairs
			expect(result).toBe(expected);
		});

		it('should handle Map with type parameters', async () => {
			const input = loadFixture('map-type-parameters', 'input');
			const expected = loadFixture('map-type-parameters', 'output');
			const result = await formatApex(input);
			// Map types should be joined with ', ' (comma space)
			expect(result).toBe(expected);
		});
	});

	describe('Real-world scenarios', () => {
		it('should format method parameters with lists', async () => {
			const input = loadFixture('method-params-lists', 'input');
			const expected = loadFixture('method-params-lists', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format return statements with maps', async () => {
			const input = loadFixture('return-statements-maps', 'input');
			const expected = loadFixture('return-statements-maps', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format variable assignments with sets', async () => {
			const input = loadFixture('variable-assignments-sets', 'input');
			const expected = loadFixture('variable-assignments-sets', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format empty list initialization', async () => {
			const input = loadFixture('list-empty', 'input');
			const expected = loadFixture('list-empty', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format empty set initialization', async () => {
			const input = loadFixture('set-empty', 'input');
			const expected = loadFixture('set-empty', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format empty map initialization', async () => {
			const input = loadFixture('map-empty', 'input');
			const expected = loadFixture('map-empty', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});
	});

	describe('Type formatting differences', () => {
		it('should format List with qualified type names using dot separator', async () => {
			// Test with a qualified type name like MyNamespace.MyClass
			// The types array would contain [MyNamespace, MyClass] which should be joined with '.'
			const input = loadFixture('list-qualified-types', 'input');
			const expected = loadFixture('list-qualified-types', 'output');
			const result = await formatApex(input);
			// Should format as multiline
			expect(result).toBe(expected);
		});

		it('should format Set with qualified type names using comma-space separator', async () => {
			// Test Set formatting - types should be joined with ', ' for Set
			const input = loadFixture('set-qualified-types', 'input');
			const expected = loadFixture('set-qualified-types', 'output');
			const result = await formatApex(input);
			// Should format as multiline
			expect(result).toBe(expected);
		});

		it('should format Map types with comma-space separator', async () => {
			const input = loadFixture('map-qualified-types', 'input');
			const expected = loadFixture('map-qualified-types', 'output');
			const result = await formatApex(input);
			// Map types should be joined with ', '
			expect(result).toBe(expected);
		});
	});

	describe('Printer branch coverage', () => {
		it('should use List type name and dot separator for List literals', async () => {
			const input = loadFixture('list-type-name', 'input');
			const expected = loadFixture('list-type-name', 'output');
			const result = await formatApex(input);
			// Verify it uses 'List' (not 'Set') and formats correctly
			expect(result).toBe(expected);
		});

		it('should use Set type name and comma-space separator for Set literals', async () => {
			const input = loadFixture('set-type-name', 'input');
			const expected = loadFixture('set-type-name', 'output');
			const result = await formatApex(input);
			// Verify it uses 'Set' (not 'List') and formats correctly
			expect(result).toBe(expected);
		});

		it('should format Map with multiple pairs using multiline format', async () => {
			const input = loadFixture('map-multiple-pairs', 'input');
			const expected = loadFixture('map-multiple-pairs', 'output');
			const result = await formatApex(input);
			// Verify multiline format with proper key-value pairs
			expect(result).toBe(expected);
		});
	});

	describe('ApexDoc {@code} block formatting', () => {
		it('should format single-line {@code} blocks', async () => {
			const input = loadFixture('apexdoc-single-line-code', 'input');
			const expected = loadFixture('apexdoc-single-line-code', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format multi-line {@code} blocks', async () => {
			const input = loadFixture('apexdoc-multi-line-code', 'input');
			const expected = loadFixture('apexdoc-multi-line-code', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should preserve invalid {@code} blocks with unmatched brackets', async () => {
			const input = loadFixture('apexdoc-invalid-brackets', 'input');
			const expected = loadFixture('apexdoc-invalid-brackets', 'output');
			const result = await formatApex(input);
			// Should preserve the original invalid block
			expect(result).toBe(expected);
		});

		it('should preserve {@code} blocks with invalid Apex code', async () => {
			const input = loadFixture('apexdoc-invalid-apex', 'input');
			const expected = loadFixture('apexdoc-invalid-apex', 'output');
			const result = await formatApex(input);
			// Should preserve the original block if formatting fails
			expect(result).toBe(expected);
		});

		it('should handle multiple {@code} blocks in one file', async () => {
			const input = loadFixture('apexdoc-multiple-blocks', 'input');
			const expected = loadFixture('apexdoc-multiple-blocks', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should handle nested braces in {@code} blocks', async () => {
			const input = loadFixture('apexdoc-nested-braces', 'input');
			const expected = loadFixture('apexdoc-nested-braces', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should maintain comment indentation alignment', async () => {
			const input = loadFixture('apexdoc-comment-indentation', 'input');
			const expected = loadFixture(
				'apexdoc-comment-indentation',
				'output',
			);
			const result = await formatApex(input);
			// Check that the comment structure is preserved
			expect(result).toBe(expected);
		});

		it('should handle empty {@code} blocks', async () => {
			const input = loadFixture('apexdoc-empty-blocks', 'input');
			const expected = loadFixture('apexdoc-empty-blocks', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should only process {@code} in ApexDoc comments', async () => {
			const input = loadFixture('apexdoc-regular-comment', 'input');
			const expected = loadFixture('apexdoc-regular-comment', 'output');
			const result = await formatApex(input);
			// Should not process {@code} in regular comments
			expect(result).toBe(expected);
		});

		it('should handle {@code} blocks in inner class methods with odd indentation (3 spaces)', async () => {
			const input = loadFixture(
				'apexdoc-inner-class-odd-indent',
				'input',
			);
			const expected = loadFixture(
				'apexdoc-inner-class-odd-indent',
				'output',
			);
			// Use tabWidth: 3 to preserve the 3-space indentation
			const result = await prettier.format(input, {
				parser: 'apex',
				plugins: [plugin],
				tabWidth: 3,
			});
			// Should correctly indent {@code} blocks when the inner class has 3 spaces of indentation
			expect(result).toBe(expected);
		});
	});
});
