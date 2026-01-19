/**
 * @file Integration tests for formatting features in the plugin.
 */

import { describe, it, expect } from 'vitest';
import { loadFixture, formatApex } from './test-utils.js';

describe('prettier-plugin-apex-imo integration', () => {
	describe('Annotation formatting', () => {
		it.concurrent.each([
			{
				description:
					'should format annotations with correct name casing',
				fixture: 'annotation-single-param',
			},
			{
				description:
					'should format annotations with multiple parameters and correct option casing',
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
					'should format annotations and modifiers with corrected casing',
				fixture: 'annotation-incorrect-casing',
			},
			{
				description: 'should normalize annotation names to PascalCase',
				fixture: 'annotation-normalize-names-pascalcase',
			},
			{
				description:
					'should normalize annotation names without parameters',
				fixture: 'annotation-normalize-names-no-params',
			},
			{
				description:
					'should normalize annotation names with parameters',
				fixture: 'annotation-normalize-names-with-params',
			},
			{
				description:
					'should normalize annotation option names to camelCase',
				fixture: 'annotation-normalize-option-names',
			},
			{
				description:
					'should handle annotation names not in the mapping',
				fixture: 'annotation-normalize-names-not-in-mapping',
			},
			{
				description: 'should handle empty parameters',
				fixture: 'annotation-normalize-empty-params',
			},
			{
				description: 'should handle multiple annotations in text',
				fixture: 'annotation-normalize-multiple',
			},
			{
				description:
					'should handle annotation with option name that matches preferred case',
				fixture:
					'annotation-normalize-option-name-matches-preferred-case',
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

	describe('Standard object type formatting', () => {
		it.concurrent.each([
			{
				description:
					'should format standard object types with correct casing',
				fixture: 'standard-object-type-normalization',
			},
			{
				description:
					'should preserve variable names even when they match standard object names',
				fixture: 'variable-name-not-type',
			},
			{
				description:
					'should format standard object types correctly in ApexDoc {@code} blocks',
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

	describe('Primitive type formatting', () => {
		it.concurrent.each([
			{
				description:
					'should format primitive types with correct casing in all contexts',
				fixture: 'primitive-type-normalization',
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

	describe('Object suffix formatting', () => {
		it.concurrent.each([
			{
				description:
					'should format object type suffixes with correct casing',
				fixture: 'object-suffix-normalization',
			},
			{
				description:
					'should format object type suffixes correctly in ApexDoc {@code} blocks',
				fixture: 'apexdoc-object-suffix-normalization',
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

	describe('Field and variable declaration wrapping', () => {
		it.concurrent.each([
			{
				description:
					'should wrap long field and variable declarations across multiple lines',
				fixture: 'wrapping-tests',
			},
			{
				description:
					'should wrap field and variable declarations with assignments across multiple lines',
				fixture: 'wrapping-assignments',
			},
			{
				description:
					'should handle multiple variable declarations on same line',
				fixture: 'variable-multiple-declarations',
			},
			{
				description:
					'should handle multiple variable declarations without assignments',
				fixture: 'variable-multiple-no-assignment',
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

	describe('Reserved word formatting', () => {
		it.concurrent.each([
			{
				description:
					'should format all reserved words with correct casing (modifiers, keywords, control flow)',
				fixture: 'reserved-word-normalization',
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

	describe('Member modifier ordering', () => {
		it.concurrent.each([
			{
				description:
					'should order field and method modifiers in outer and inner classes',
				fixture: 'member-modifiers-order',
			},
			{
				description:
					'should order field and method modifiers inside ApexDoc {@code} blocks',
				fixture: 'apexdoc-member-modifiers-order',
			},
			{
				description:
					'should preserve order of modifiers with same rank (tie-breaker)',
				fixture: 'member-modifiers-tie-breaker',
			},
			{
				description:
					'should preserve order when modifier ranks are equal',
				fixture: 'member-modifiers-same-rank',
			},
			{
				description:
					'should preserve order of multiple annotations with same rank',
				fixture: 'member-modifiers-multiple-annotations',
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

	describe('Method spacing', () => {
		it.concurrent.each([
			{
				description:
					'should add blank lines between consecutive methods with annotations',
				fixture: 'method-spacing-with-annotations',
			},
			{
				description:
					'should add blank lines between consecutive methods without annotations',
				fixture: 'method-spacing-no-annotations',
			},
			{
				description:
					'should add blank lines between consecutive methods when class has modifiers',
				fixture: 'method-spacing-with-modifiers',
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
