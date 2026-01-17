/**
 * @file Unit tests for the apexdoc-group module.
 */

import { describe, it, expect } from 'vitest';
import { normalizeGroupContent } from '../src/apexdoc-group.js';

describe('apexdoc-group', () => {
	describe('normalizeGroupContent', () => {
		it.concurrent('should normalize group name with description', () => {
			expect(normalizeGroupContent('class My description')).toBe(
				'Class My description',
			);
			expect(normalizeGroupContent('method Helper methods')).toBe(
				'Method Helper methods',
			);
			expect(normalizeGroupContent('interface API interfaces')).toBe(
				'Interface API interfaces',
			);
		});

		it.concurrent('should normalize group name without description', () => {
			expect(normalizeGroupContent('class')).toBe('Class');
			expect(normalizeGroupContent('method')).toBe('Method');
			expect(normalizeGroupContent('interface')).toBe('Interface');
		});

		it.concurrent('should handle empty string', () => {
			expect(normalizeGroupContent('')).toBe('');
		});

		it.concurrent('should handle whitespace-only string', () => {
			expect(normalizeGroupContent('   ')).toBe('');
		});

		it.concurrent('should preserve case for unknown group names', () => {
			expect(normalizeGroupContent('unknown')).toBe('unknown');
			expect(normalizeGroupContent('UnknownGroup')).toBe('UnknownGroup');
		});

		it.concurrent(
			'should normalize known group names to proper case',
			() => {
				expect(normalizeGroupContent('class')).toBe('Class');
				expect(normalizeGroupContent('method')).toBe('Method');
				expect(normalizeGroupContent('interface')).toBe('Interface');
				expect(normalizeGroupContent('enum')).toBe('Enum');
				expect(normalizeGroupContent('property')).toBe('Property');
				expect(normalizeGroupContent('variable')).toBe('Variable');
			},
		);

		it.concurrent(
			'should handle group names with multiple spaces in description',
			() => {
				expect(normalizeGroupContent('class   My   description')).toBe(
					'Class   My   description',
				);
			},
		);

		it.concurrent(
			'should handle group names with leading/trailing whitespace',
			() => {
				expect(normalizeGroupContent('  class description  ')).toBe(
					'Class description',
				);
			},
		);

		it.concurrent('should handle single word after normalization', () => {
			expect(normalizeGroupContent('class')).toBe('Class');
			expect(normalizeGroupContent('method')).toBe('Method');
		});

		it.concurrent(
			'should handle multiple words (group name + description)',
			() => {
				expect(normalizeGroupContent('class Test class')).toBe(
					'Class Test class',
				);
				expect(normalizeGroupContent('method Helper method')).toBe(
					'Method Helper method',
				);
			},
		);
	});
});
