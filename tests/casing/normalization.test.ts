/**
 * @file Unit tests for normalization functions in the casing module.
 */

import { describe, it, expect } from 'vitest';
import {
	normalizeTypeName,
	normalizeReservedWord,
	normalizeStandardObjectType,
} from '../../src/casing.js';

describe('casing', () => {
	describe('normalizeReservedWord', () => {
		it.concurrent.each([
			// Reserved words with various cases
			{ expected: 'public', input: 'PUBLIC' },
			{ expected: 'private', input: 'Private' },
			{ expected: 'static', input: 'STATIC' },
			{ expected: 'final', input: 'Final' },
			{ expected: 'class', input: 'CLASS' },
			{ expected: 'interface', input: 'Interface' },
			{ expected: 'enum', input: 'ENUM' },
			{ expected: 'void', input: 'Void' },
			{ expected: 'abstract', input: 'ABSTRACT' },
			{ expected: 'virtual', input: 'Virtual' },
			{ expected: 'if', input: 'IF' },
			{ expected: 'else', input: 'Else' },
			{ expected: 'for', input: 'FOR' },
			{ expected: 'while', input: 'While' },
			{ expected: 'return', input: 'RETURN' },
			{ expected: 'try', input: 'Try' },
			{ expected: 'catch', input: 'CATCH' },
			{ expected: 'finally', input: 'Finally' },
			{ expected: 'new', input: 'NEW' },
			{ expected: 'this', input: 'This' },
			{ expected: 'super', input: 'SUPER' },
			{ expected: 'null', input: 'NULL' },
			{ expected: 'protected', input: 'PROTECTED' },
			{ expected: 'transient', input: 'TRANSIENT' },
			{ expected: 'global', input: 'GLOBAL' },
			{ expected: 'webservice', input: 'WEBSERVICE' },
			{ expected: 'switch', input: 'SWITCH' },
			{ expected: 'case', input: 'CASE' },
			{ expected: 'default', input: 'DEFAULT' },
			{ expected: 'do', input: 'DO' },
			{ expected: 'break', input: 'BREAK' },
			{ expected: 'continue', input: 'CONTINUE' },
			// Already lowercase reserved words
			{ expected: 'public', input: 'public' },
			{ expected: 'private', input: 'private' },
			{ expected: 'static', input: 'static' },
			{ expected: 'class', input: 'class' },
			{ expected: 'interface', input: 'interface' },
			// Non-reserved words (should return unchanged)
			{ expected: 'MyVariable', input: 'MyVariable' },
			{ expected: 'myVariable', input: 'myVariable' },
			{ expected: 'MYVARIABLE', input: 'MYVARIABLE' },
			{ expected: 'Account', input: 'Account' },
			{ expected: 'String', input: 'String' },
			// Empty string
			{ expected: '', input: '' },
		])(
			'should normalize "$input" to "$expected"',
			({
				expected,
				input,
			}: Readonly<{ expected: string; input: string }>) => {
				expect(normalizeReservedWord(input)).toBe(expected);
			},
		);
	});

	describe('normalizeTypeName', () => {
		it.concurrent('should normalize primitive types to PascalCase', () => {
			// Test that primitives are normalized first, before standard objects
			expect(normalizeTypeName('string')).toBe('String');
			expect(normalizeTypeName('integer')).toBe('Integer');
			expect(normalizeTypeName('boolean')).toBe('Boolean');
			expect(normalizeTypeName('blob')).toBe('Blob');
			expect(normalizeTypeName('date')).toBe('Date');
			expect(normalizeTypeName('datetime')).toBe('Datetime');
			expect(normalizeTypeName('decimal')).toBe('Decimal');
			expect(normalizeTypeName('double')).toBe('Double');
			expect(normalizeTypeName('id')).toBe('ID');
			expect(normalizeTypeName('long')).toBe('Long');
			expect(normalizeTypeName('object')).toBe('Object');
			expect(normalizeTypeName('time')).toBe('Time');
			expect(normalizeTypeName('sobject')).toBe('SObject');
		});

		it.concurrent('should normalize collection types to PascalCase', () => {
			expect(normalizeTypeName('list')).toBe('List');
			expect(normalizeTypeName('set')).toBe('Set');
			expect(normalizeTypeName('map')).toBe('Map');
		});

		it.concurrent(
			'should normalize primitives regardless of input case',
			() => {
				expect(normalizeTypeName('STRING')).toBe('String');
				expect(normalizeTypeName('String')).toBe('String');
				expect(normalizeTypeName('sTrInG')).toBe('String');
				expect(normalizeTypeName('INTEGER')).toBe('Integer');
				expect(normalizeTypeName('Integer')).toBe('Integer');
				expect(normalizeTypeName('iNtEgEr')).toBe('Integer');
				expect(normalizeTypeName('ID')).toBe('ID');
				expect(normalizeTypeName('Id')).toBe('ID');
				expect(normalizeTypeName('id')).toBe('ID');
			},
		);

		it.concurrent(
			'should normalize standard objects and then suffixes',
			() => {
				// Test that standard object normalization happens first, then suffix normalization
				expect(normalizeTypeName('account__C')).toBe('Account__c');
				expect(normalizeTypeName('contact__c')).toBe('Contact__c');
				expect(normalizeTypeName('MyCustomObject__C')).toBe(
					'MyCustomObject__c',
				);
			},
		);

		it.concurrent(
			'should handle types that are not primitives or standard objects',
			() => {
				expect(normalizeTypeName('MyCustomClass')).toBe(
					'MyCustomClass',
				);
				expect(normalizeTypeName('SomeOtherType')).toBe(
					'SomeOtherType',
				);
			},
		);

		it.concurrent(
			'should handle types with only standard object normalization',
			() => {
				expect(normalizeTypeName('account')).toBe('Account');
				expect(normalizeTypeName('contact')).toBe('Contact');
			},
		);

		it.concurrent(
			'should handle types with only suffix normalization',
			() => {
				expect(normalizeTypeName('MyCustomObject__C')).toBe(
					'MyCustomObject__c',
				);
				expect(normalizeTypeName('MyCustomObject__CHANGEEVENT')).toBe(
					'MyCustomObject__ChangeEvent',
				);
			},
		);

		it.concurrent('should handle empty string input', () => {
			// Test empty string handling in both functions
			expect(normalizeTypeName('')).toBe('');
			expect(normalizeStandardObjectType('')).toBe('');
		});

		it.concurrent(
			'should return unchanged for types without normalization needs',
			() => {
				expect(normalizeTypeName('MyCustomClass')).toBe(
					'MyCustomClass',
				);
				// String is already in correct case, so it returns unchanged
				expect(normalizeTypeName('String')).toBe('String');
			},
		);
	});
});
