/**
 * @file Integration tests for the plugin.
 */

import { describe, it, expect } from 'vitest';
import { loadFixture, formatApex } from './test-utils.js';

describe('prettier-plugin-apex-imo integration', () => {
	describe('List formatting', () => {
		it.concurrent.each([
			{
				description: 'should keep single-item lists inline',
				fixture: 'list-single',
			},
			{
				description: 'should format multi-item lists as multiline',
				fixture: 'list-multiline',
			},
			{
				description: 'should handle lists with 2 items (multiline)',
				fixture: 'list-two-items',
			},
			{
				description: 'should handle lists with 3+ items (multiline)',
				fixture: 'list-three-items',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('Set formatting', () => {
		it.concurrent.each([
			{
				description: 'should keep single-item sets inline',
				fixture: 'set-single',
			},
			{
				description: 'should format multi-item sets as multiline',
				fixture: 'set-multiline',
			},
			{
				description: 'should handle sets with 2 items (multiline)',
				fixture: 'set-two-items',
			},
			{
				description: 'should handle sets with 3+ items (multiline)',
				fixture: 'set-three-items',
			},
			{
				description:
					'should format Set types correctly with type parameters',
				fixture: 'set-type-parameters',
			},
			{
				description:
					'should format List with multiple entries using List type name',
				fixture: 'list-multiple-entries',
			},
			{
				description:
					'should format Set with multiple entries using Set type name',
				fixture: 'set-multiple-entries',
			},
			{
				description: 'should format Set correctly',
				fixture: 'set-generic-types',
			},
			{
				description: 'should format List correctly',
				fixture: 'list-generic-types',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('Map formatting', () => {
		it.concurrent.each([
			{
				description: 'should keep single-pair maps inline',
				fixture: 'map-single',
			},
			{
				description: 'should format multi-pair maps as multiline',
				fixture: 'map-multiline',
			},
			{
				description: 'should handle maps with 2 pairs (multiline)',
				fixture: 'map-two-pairs',
			},
			{
				description: 'should handle maps with 3+ pairs (multiline)',
				fixture: 'map-three-pairs',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('Nested and mixed structures', () => {
		it.concurrent.each([
			{
				description:
					'should handle Map with List values (nested lists)',
				fixture: 'nested',
			},
			{
				description: 'should handle mixed list/map scenarios correctly',
				fixture: 'mixed',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('Edge cases', () => {
		it.concurrent.each([
			{
				description: 'should handle empty lists',
				fixture: 'list-empty',
			},
			{
				description: 'should handle empty sets',
				fixture: 'set-empty',
			},
			{
				description: 'should handle empty maps',
				fixture: 'map-empty',
			},
			{
				description: 'should keep single-item lists inline',
				fixture: 'list-single-item',
			},
			{
				description: 'should keep single-item sets inline',
				fixture: 'set-single-item',
			},
			{
				description: 'should keep single-pair maps inline',
				fixture: 'map-single-pair',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('Complex scenarios', () => {
		it.concurrent.each([
			{
				description: 'should handle lists with different data types',
				fixture: 'list-mixed-types',
			},
			{
				description: 'should handle maps with complex values',
				fixture: 'map-complex-values',
			},
			{
				description: 'should handle nested lists within lists',
				fixture: 'list-nested',
			},
			{
				description: 'should handle lists with many items',
				fixture: 'list-many-items',
			},
			{
				description: 'should handle maps with many pairs',
				fixture: 'map-many-pairs',
			},
			{
				description: 'should handle Set with generic types',
				fixture: 'set-generic-types',
			},
			{
				description: 'should handle List with generic types',
				fixture: 'list-generic-types',
			},
			{
				description: 'should handle Map with complex key types',
				fixture: 'map-complex-keys',
			},
			{
				description: 'should handle Map with type parameters',
				fixture: 'map-type-parameters',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('Real-world scenarios', () => {
		it.concurrent.each([
			{
				description: 'should format method parameters with lists',
				fixture: 'method-params-lists',
			},
			{
				description: 'should format return statements with maps',
				fixture: 'return-statements-maps',
			},
			{
				description: 'should format variable assignments with sets',
				fixture: 'variable-assignments-sets',
			},
			{
				description: 'should format empty list initialization',
				fixture: 'list-empty',
			},
			{
				description: 'should format empty set initialization',
				fixture: 'set-empty',
			},
			{
				description: 'should format empty map initialization',
				fixture: 'map-empty',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('Type formatting differences', () => {
		it.concurrent.each([
			{
				description:
					'should format List with qualified type names using dot separator',
				fixture: 'list-qualified-types',
			},
			{
				description:
					'should format Set with qualified type names using comma-space separator',
				fixture: 'set-qualified-types',
			},
			{
				description:
					'should format Map types with comma-space separator',
				fixture: 'map-qualified-types',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('Collection type name formatting', () => {
		it.concurrent.each([
			{
				description:
					'should use List type name and dot separator for List literals',
				fixture: 'list-type-name',
			},
			{
				description:
					'should use Set type name and comma-space separator for Set literals',
				fixture: 'set-type-name',
			},
			{
				description:
					'should format Map with multiple pairs using multiline format',
				fixture: 'map-multiple-pairs',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('ApexDoc {@code} block formatting', () => {
		it.concurrent.each([
			{
				description: 'should format single-line {@code} blocks',
				fixture: 'apexdoc-single-line-code',
			},
			{
				description: 'should format multi-line {@code} blocks',
				fixture: 'apexdoc-multi-line-code',
			},
			{
				description:
					'should preserve invalid {@code} blocks with unmatched brackets',
				fixture: 'apexdoc-invalid-brackets',
			},
			{
				description:
					'should preserve {@code} blocks with invalid Apex code',
				fixture: 'apexdoc-invalid-apex',
			},
			{
				description:
					'should handle multiple {@code} blocks in one file',
				fixture: 'apexdoc-multiple-blocks',
			},
			{
				description: 'should handle nested braces in {@code} blocks',
				fixture: 'apexdoc-nested-braces',
			},
			{
				description: 'should maintain comment indentation alignment',
				fixture: 'apexdoc-comment-indentation',
			},
			{
				description: 'should handle empty {@code} blocks',
				fixture: 'apexdoc-empty-blocks',
			},
			{
				description: 'should only process {@code} in ApexDoc comments',
				fixture: 'apexdoc-regular-comment',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);

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
			const result = await formatApex(input, { tabWidth: 3 });
			// Should correctly indent {@code} blocks when the inner class has 3 spaces of indentation
			expect(result).toBe(expected);
		});
	});

	describe('Annotation formatting', () => {
		it.concurrent.each([
			{
				description: 'should normalize annotation names to PascalCase',
				fixture: 'annotation-single-param',
			},
			{
				description:
					'should normalize annotation option names to camelCase',
				fixture: 'annotation-multiple-params',
			},
			{
				description:
					'should format InvocableMethod with multiple parameters on multiple lines',
				fixture: 'annotation-invocable-multiline',
			},
			{
				description:
					'should format SuppressWarnings with comma-separated string',
				fixture: 'annotation-suppress-warnings',
			},
			{
				description:
					'should format annotations in ApexDoc {@code} blocks',
				fixture: 'annotation-apexdoc-code',
			},
			{
				description: 'should handle alternative spacing in annotations',
				fixture: 'annotation-alternative-spacing',
			},
			{
				description:
					'should use smart wrapping for InvocableMethod with multiple parameters',
				fixture: 'annotation-smart-wrapping',
			},
			{
				description:
					'should use page-width wrapping for long annotations',
				fixture: 'annotation-page-width-wrapping',
			},
			{
				description:
					'should normalize incorrect casing in annotations and modifiers',
				fixture: 'annotation-incorrect-casing',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('Standard object type normalization', () => {
		it.concurrent.each([
			{
				description:
					'should normalize standard object types to correct casing',
				fixture: 'standard-object-type-normalization',
			},
			{
				description:
					'should not convert variable names that match standard object names',
				fixture: 'variable-name-not-type',
			},
			{
				description:
					'should normalize standard object types in ApexDoc {@code} blocks',
				fixture: 'apexdoc-standard-object-type',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});
});
