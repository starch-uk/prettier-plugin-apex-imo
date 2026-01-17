/**
 * @file Unit tests for the apexdoc-group module.
 */

import { describe, it, expect } from 'vitest';
import { normalizeGroupContent } from '../src/apexdoc-group.js';

describe('apexdoc-group', () => {
	describe('normalizeGroupContent', () => {
		it.concurrent.each([
			{ expected: 'Class', input: 'class' },
			{ expected: 'Method', input: 'method' },
			{ expected: 'Interface', input: 'interface' },
			{ expected: 'Enum', input: 'enum' },
			{ expected: 'Property', input: 'property' },
			{ expected: 'Variable', input: 'variable' },
			{ expected: 'Class My description', input: 'class My description' },
			{
				expected: 'Method Helper methods',
				input: 'method Helper methods',
			},
			{
				expected: 'Interface API interfaces',
				input: 'interface API interfaces',
			},
		])(
			'should normalize "$input" to "$expected"',
			({
				expected,
				input,
			}: Readonly<{ expected: string; input: string }>) => {
				expect(normalizeGroupContent(input)).toBe(expected);
			},
		);

		it.concurrent.each([
			{ expected: '', input: '' },
			{ expected: '', input: '   ' },
		])(
			'should handle "$input" as empty',
			({
				expected,
				input,
			}: Readonly<{ expected: string; input: string }>) => {
				expect(normalizeGroupContent(input)).toBe(expected);
			},
		);

		it.concurrent.each([
			{ expected: 'unknown', input: 'unknown' },
			{ expected: 'UnknownGroup', input: 'UnknownGroup' },
		])(
			'should preserve case for unknown group name "$input"',
			({
				expected,
				input,
			}: Readonly<{ expected: string; input: string }>) => {
				expect(normalizeGroupContent(input)).toBe(expected);
			},
		);

		it.concurrent.each([
			{
				expected: 'Class   My   description',
				input: 'class   My   description',
			},
			{ expected: 'Class description', input: '  class description  ' },
		])(
			'should handle whitespace in "$input"',
			({
				expected,
				input,
			}: Readonly<{ expected: string; input: string }>) => {
				expect(normalizeGroupContent(input)).toBe(expected);
			},
		);
	});
});
