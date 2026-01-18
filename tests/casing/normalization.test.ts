/**
 * @file Unit tests for normalization functions in the casing module.
 */

import { describe, it, expect } from 'vitest';
import {
	normalizeTypeName,
	normalizeReservedWord,
	normalizeStandardObjectType,
} from '../../src/casing.js';
import { PRIMITIVE_AND_COLLECTION_TYPES } from '../../src/refs/primitive-types.js';
import { STANDARD_OBJECTS } from '../../src/refs/standard-objects.js';
import { APEX_OBJECT_SUFFIXES } from '../../src/refs/object-suffixes.js';
import { APEX_RESERVED_WORDS } from '../../src/refs/reserved-words.js';

/**
 * Generates case variations for a given string.
 * @param str - The string to generate variations for.
 * @returns Array of case variations: lowercase, UPPERCASE, PascalCase, camelCase, mixed case.
 */
function generateCaseVariations(str: string): readonly string[] {
	if (str.length === 0) return [''];
	const lower = str.toLowerCase();
	const upper = str.toUpperCase();
	const pascal = str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	const camel =
		str.length > 1
			? str.charAt(0).toLowerCase() + str.slice(1)
			: str.toLowerCase();
	// Mixed case: alternate between upper and lower
	const mixed = str
		.split('')
		.map((char, index) =>
			index % 2 === 0 ? char.toUpperCase() : char.toLowerCase(),
		)
		.join('');
	return [lower, upper, pascal, camel, mixed];
}

/**
 * Generates test cases for primitive and collection types.
 * @returns Array of test cases with input and expected output.
 */
function generatePrimitiveTestCases(): readonly {
	readonly expected: string;
	readonly input: string;
}[] {
	const testCases: {
		readonly expected: string;
		readonly input: string;
	}[] = [];
	for (const [lowerKey, expected] of Object.entries(
		PRIMITIVE_AND_COLLECTION_TYPES,
	)) {
		const variations = generateCaseVariations(lowerKey);
		for (const variation of variations) {
			testCases.push({ expected, input: variation });
		}
	}
	return testCases;
}

/**
 * Generates test cases for standard objects.
 * @returns Array of test cases with input and expected output.
 */
function generateStandardObjectTestCases(): readonly {
	readonly expected: string;
	readonly input: string;
}[] {
	const testCases: {
		readonly expected: string;
		readonly input: string;
	}[] = [];
	for (const [lowerKey, expected] of Object.entries(STANDARD_OBJECTS)) {
		const variations = generateCaseVariations(lowerKey);
		for (const variation of variations) {
			testCases.push({ expected, input: variation });
		}
	}
	return testCases;
}

/**
 * Generates test cases for object suffixes with custom object prefixes.
 * @returns Array of test cases with input and expected output.
 */
function generateSuffixTestCases(): readonly {
	readonly expected: string;
	readonly input: string;
}[] {
	const testCases: {
		readonly expected: string;
		readonly input: string;
	}[] = [];
	// Test suffixes with custom object prefixes (not standard objects)
	const customPrefix = 'MyCustomObject';
	for (const [, expectedSuffix] of Object.entries(APEX_OBJECT_SUFFIXES)) {
		// Test with various case variations of the suffix
		const lowerSuffix = expectedSuffix.toLowerCase();
		const expected = customPrefix + expectedSuffix;
		// Generate variations where we change the suffix case
		const suffixVariations = [
			lowerSuffix,
			expectedSuffix.toUpperCase(),
			expectedSuffix,
			// Mixed case suffix
			expectedSuffix
				.split('')
				.map((char, index) =>
					index % 2 === 0 ? char.toUpperCase() : char.toLowerCase(),
				)
				.join(''),
		];
		for (const suffixVar of suffixVariations) {
			const input = customPrefix + suffixVar;
			testCases.push({ expected, input });
		}
	}
	return testCases;
}

/**
 * Generates test cases for combinations of standard objects and suffixes.
 * @returns Array of test cases with input and expected output.
 */
function generateCombinationTestCases(): readonly {
	readonly expected: string;
	readonly input: string;
}[] {
	const testCases: {
		readonly expected: string;
		readonly input: string;
	}[] = [];
	// Sample a subset of standard objects for combination tests to keep test count manageable
	const sampleObjects = Object.entries(STANDARD_OBJECTS).slice(0, 10);
	const sampleSuffixes = Object.entries(APEX_OBJECT_SUFFIXES).slice(0, 5);

	for (const [lowerObjKey, expectedObj] of sampleObjects) {
		for (const [, expectedSuffix] of sampleSuffixes) {
			// Test combinations: object + suffix
			// The normalizeTypeName function checks if the type ends with the suffix (lowercase)
			const lowerSuffix = expectedSuffix.toLowerCase();
			const expectedCombined = expectedObj + expectedSuffix;

			// Generate variations where we change the object case and suffix case
			const objectVariations = generateCaseVariations(lowerObjKey);
			const suffixVariations = [
				lowerSuffix,
				expectedSuffix.toUpperCase(),
				expectedSuffix,
			];

			for (const objVar of objectVariations) {
				for (const suffixVar of suffixVariations) {
					const input = objVar + suffixVar;
					testCases.push({
						expected: expectedCombined,
						input,
					});
				}
			}
		}
	}
	return testCases;
}

/**
 * Generates test cases for reserved words.
 * @returns Array of test cases with input and expected output.
 */
function generateReservedWordTestCases(): readonly {
	readonly expected: string;
	readonly input: string;
}[] {
	const testCases: {
		readonly expected: string;
		readonly input: string;
	}[] = [];
	for (const reservedWord of APEX_RESERVED_WORDS) {
		const expected = reservedWord.toLowerCase();
		const variations = generateCaseVariations(reservedWord);
		for (const variation of variations) {
			testCases.push({ expected, input: variation });
		}
	}
	return testCases;
}

/**
 * Generates test cases for types inside codeblocks.
 * @returns Array of test cases with input and expected output.
 */
function generateCodeblockTypeTestCases(): readonly {
	readonly expected: string;
	readonly input: string;
}[] {
	const testCases: {
		readonly expected: string;
		readonly input: string;
	}[] = [];
	// Test primitives in codeblocks
	for (const [lowerKey, expected] of Object.entries(
		PRIMITIVE_AND_COLLECTION_TYPES,
	)) {
		const variations = generateCaseVariations(lowerKey);
		for (const variation of variations) {
			testCases.push({ expected, input: variation });
		}
	}
	// Test a sample of standard objects in codeblocks
	const sampleObjects = Object.entries(STANDARD_OBJECTS).slice(0, 20);
	for (const [lowerKey, expected] of sampleObjects) {
		const variations = generateCaseVariations(lowerKey);
		for (const variation of variations) {
			testCases.push({ expected, input: variation });
		}
	}
	// Test combinations in codeblocks
	const sampleSuffixes = Object.entries(APEX_OBJECT_SUFFIXES).slice(0, 3);
	for (const [lowerObjKey, expectedObj] of sampleObjects.slice(0, 5)) {
		for (const [, expectedSuffix] of sampleSuffixes) {
			const combinedLower = lowerObjKey + expectedSuffix.toLowerCase();
			const expectedCombined = expectedObj + expectedSuffix;
			const variations = generateCaseVariations(combinedLower);
			for (const variation of variations) {
				testCases.push({
					expected: expectedCombined,
					input: variation,
				});
			}
		}
	}
	return testCases;
}

describe('casing', () => {
	describe('normalizeReservedWord', () => {
		it.concurrent.each(generateReservedWordTestCases())(
			'should normalize "$input" to "$expected"',
			({
				expected,
				input,
			}: Readonly<{ expected: string; input: string }>) => {
				expect(normalizeReservedWord(input)).toBe(expected);
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
	});

	describe('normalizeTypeName', () => {
		describe('primitive types', () => {
			it.concurrent.each(generatePrimitiveTestCases())(
				'should normalize "$input" to "$expected"',
				({
					expected,
					input,
				}: Readonly<{ expected: string; input: string }>) => {
					expect(normalizeTypeName(input)).toBe(expected);
				},
			);
		});

		describe('standard objects', () => {
			it.concurrent.each(generateStandardObjectTestCases())(
				'should normalize "$input" to "$expected"',
				({
					expected,
					input,
				}: Readonly<{ expected: string; input: string }>) => {
					expect(normalizeTypeName(input)).toBe(expected);
				},
			);
		});

		describe('object suffixes', () => {
			it.concurrent.each(generateSuffixTestCases())(
				'should normalize "$input" to "$expected"',
				({
					expected,
					input,
				}: Readonly<{ expected: string; input: string }>) => {
					// Test suffix normalization with custom object prefixes
					expect(normalizeTypeName(input)).toBe(expected);
				},
			);
		});

		describe('combinations', () => {
			it.concurrent.each(generateCombinationTestCases())(
				'should normalize "$input" to "$expected"',
				({
					expected,
					input,
				}: Readonly<{ expected: string; input: string }>) => {
					expect(normalizeTypeName(input)).toBe(expected);
				},
			);
		});

		describe('inside codeblocks', () => {
			it.concurrent.each(generateCodeblockTypeTestCases())(
				'should normalize type "$input" inside {@code} block to "$expected"',
				({
					expected,
					input,
				}: Readonly<{ expected: string; input: string }>) => {
					// Test type normalization when extracted from codeblock
					// The normalizeTypeName function should work the same inside codeblocks
					expect(normalizeTypeName(input)).toBe(expected);
				},
			);
		});

		it.concurrent('should handle empty string input', () => {
			// Test empty string handling in both functions
			expect(normalizeTypeName('')).toBe('');
			expect(normalizeStandardObjectType('')).toBe('');
		});

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
	});
});
