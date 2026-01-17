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
		it.concurrent('should normalize reserved words to lowercase', () => {
			expect(normalizeReservedWord('PUBLIC')).toBe('public');
			expect(normalizeReservedWord('Private')).toBe('private');
			expect(normalizeReservedWord('STATIC')).toBe('static');
			expect(normalizeReservedWord('Final')).toBe('final');
			expect(normalizeReservedWord('CLASS')).toBe('class');
			expect(normalizeReservedWord('Interface')).toBe('interface');
			expect(normalizeReservedWord('ENUM')).toBe('enum');
			expect(normalizeReservedWord('Void')).toBe('void');
			expect(normalizeReservedWord('ABSTRACT')).toBe('abstract');
			expect(normalizeReservedWord('Virtual')).toBe('virtual');
			expect(normalizeReservedWord('IF')).toBe('if');
			expect(normalizeReservedWord('Else')).toBe('else');
			expect(normalizeReservedWord('FOR')).toBe('for');
			expect(normalizeReservedWord('While')).toBe('while');
			expect(normalizeReservedWord('RETURN')).toBe('return');
			expect(normalizeReservedWord('Try')).toBe('try');
			expect(normalizeReservedWord('CATCH')).toBe('catch');
			expect(normalizeReservedWord('Finally')).toBe('finally');
			expect(normalizeReservedWord('NEW')).toBe('new');
			expect(normalizeReservedWord('This')).toBe('this');
			expect(normalizeReservedWord('SUPER')).toBe('super');
			expect(normalizeReservedWord('NULL')).toBe('null');
		});

		it.concurrent(
			'should return lowercase unchanged for reserved words already in lowercase',
			() => {
				expect(normalizeReservedWord('public')).toBe('public');
				expect(normalizeReservedWord('private')).toBe('private');
				expect(normalizeReservedWord('static')).toBe('static');
				expect(normalizeReservedWord('class')).toBe('class');
				expect(normalizeReservedWord('interface')).toBe('interface');
			},
		);

		it.concurrent('should return unchanged for non-reserved words', () => {
			expect(normalizeReservedWord('MyVariable')).toBe('MyVariable');
			expect(normalizeReservedWord('myVariable')).toBe('myVariable');
			expect(normalizeReservedWord('MYVARIABLE')).toBe('MYVARIABLE');
			expect(normalizeReservedWord('Account')).toBe('Account');
			expect(normalizeReservedWord('String')).toBe('String');
		});

		it.concurrent('should handle empty string', () => {
			expect(normalizeReservedWord('')).toBe('');
		});

		it.concurrent('should handle all declaration modifiers', () => {
			expect(normalizeReservedWord('PUBLIC')).toBe('public');
			expect(normalizeReservedWord('PRIVATE')).toBe('private');
			expect(normalizeReservedWord('PROTECTED')).toBe('protected');
			expect(normalizeReservedWord('STATIC')).toBe('static');
			expect(normalizeReservedWord('FINAL')).toBe('final');
			expect(normalizeReservedWord('TRANSIENT')).toBe('transient');
			expect(normalizeReservedWord('GLOBAL')).toBe('global');
			expect(normalizeReservedWord('WEBSERVICE')).toBe('webservice');
		});

		it.concurrent('should handle type-related reserved words', () => {
			expect(normalizeReservedWord('ENUM')).toBe('enum');
			expect(normalizeReservedWord('CLASS')).toBe('class');
			expect(normalizeReservedWord('INTERFACE')).toBe('interface');
			expect(normalizeReservedWord('VOID')).toBe('void');
			expect(normalizeReservedWord('ABSTRACT')).toBe('abstract');
			expect(normalizeReservedWord('VIRTUAL')).toBe('virtual');
		});

		it.concurrent('should handle control flow keywords', () => {
			expect(normalizeReservedWord('IF')).toBe('if');
			expect(normalizeReservedWord('ELSE')).toBe('else');
			expect(normalizeReservedWord('SWITCH')).toBe('switch');
			expect(normalizeReservedWord('CASE')).toBe('case');
			expect(normalizeReservedWord('DEFAULT')).toBe('default');
			expect(normalizeReservedWord('FOR')).toBe('for');
			expect(normalizeReservedWord('WHILE')).toBe('while');
			expect(normalizeReservedWord('DO')).toBe('do');
			expect(normalizeReservedWord('BREAK')).toBe('break');
			expect(normalizeReservedWord('CONTINUE')).toBe('continue');
			expect(normalizeReservedWord('RETURN')).toBe('return');
		});
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
			expect(normalizeTypeName('')).toBe('');
		});

		it.concurrent(
			'should handle empty string in normalizeStandardObjectType',
			() => {
				// Test the defensive empty string check in normalizeStandardObjectType
				expect(normalizeStandardObjectType('')).toBe('');
			},
		);

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
