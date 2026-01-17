/**
 * @file Integration tests for formatting features in the plugin.
 */

import { describe, it, expect } from 'vitest';
import { loadFixture, formatApex } from './test-utils.js';

describe('prettier-plugin-apex-imo integration', () => {
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

	describe('Primitive type normalization', () => {
		it.concurrent.each([
			{
				description:
					'should normalize primitive types to PascalCase in variables, parameters, generics, and attributes',
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

	describe('Object suffix normalization', () => {
		it.concurrent.each([
			{
				description:
					'should normalize object type suffixes to correct casing',
				fixture: 'object-suffix-normalization',
			},
			{
				description:
					'should normalize object type suffixes in ApexDoc {@code} blocks',
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

	describe('Reserved word normalization', () => {
		it.concurrent.each([
			{
				description:
					'should normalize all reserved words to lowercase (modifiers, keywords, control flow)',
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
});
