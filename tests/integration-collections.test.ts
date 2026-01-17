/**
 * @file Integration tests for collection formatting in the plugin.
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

	describe('PageWidth wrapping for nested collections', () => {
		it.concurrent.each([
			{
				description:
					'should break Map assignment when exceeding pageWidth',
				fixture: 'map-assignment-pagewidth',
			},
			{
				description:
					'should wrap nested Map collections when exceeding pageWidth',
				fixture: 'nested-collection-pagewidth',
			},
			{
				description:
					'should wrap nested List collections when exceeding pageWidth',
				fixture: 'nested-list-pagewidth',
			},
			{
				description:
					'should wrap nested Set collections when exceeding pageWidth',
				fixture: 'nested-set-pagewidth',
			},
			{
				description:
					'should wrap List containing Map when exceeding pageWidth',
				fixture: 'list-map-pagewidth',
			},
			{
				description:
					'should wrap Set containing Map when exceeding pageWidth',
				fixture: 'set-map-pagewidth',
			},
			{
				description:
					'should wrap List containing List when exceeding pageWidth',
				fixture: 'list-list-pagewidth',
			},
			{
				description:
					'should wrap Set containing List when exceeding pageWidth',
				fixture: 'set-list-pagewidth',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input, { printWidth: 80 });
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
			{
				description:
					'should format single variable with complex Map type',
				fixture: 'variable-single-map-complex',
			},
			{
				description:
					'should format single variable with nested Map type',
				fixture: 'variable-single-map-nested-type',
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
});
