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
					'should format @AuraEnabled annotation in {@code} blocks',
				fixture: 'apexdoc-code-block-annotation',
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

		it.concurrent.each([
			{
				description:
					'should format simple integer assignment in {@code} blocks',
				fixture: 'formatcodeblock-simple-integer',
			},
			{
				description:
					'should format @Deprecated annotation in {@code} blocks',
				fixture: 'formatcodeblock-deprecated',
			},
			{
				description: 'should preserve invalid code in {@code} blocks',
				fixture: 'formatcodeblock-invalid-apex',
			},
			{
				description:
					'should preserve multiline @InvocableMethod in {@code} blocks',
				fixture: 'formatcodeblock-invocable-multiline',
			},
			{
				description: 'should format multi-line code in {@code} blocks',
				fixture: 'formatcodeblock-multi-line-code',
			},
			{
				description: 'should format single-line code in {@code} blocks',
				fixture: 'formatcodeblock-single-line-code',
			},
			{
				description: 'should format @TestAnnotation in {@code} blocks',
				fixture: 'formatcodeblock-test-annotation',
			},
			{
				description:
					'should preserve @TestAnnotation with value in {@code} blocks',
				fixture: 'formatcodeblock-test-annotation-value',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{ description: string; fixture: string }>) => {
				const codeContent = loadFixture(fixture, 'input').trim();
				const expectedCode = loadFixture(fixture, 'output').trim();
				// Wrap the code content in an ApexDoc comment
				const input = `public class Test {
  /**
   * Example method.
   * {@code ${codeContent} }
   */
  public void method() {}
}
`;
				const result = await formatApex(input);
				// Extract the code block from the result
				// Find the {@code tag and extract everything until the closing } on a line with just * }
				const NOT_FOUND_INDEX = -1;
				const CODE_TAG_LENGTH = 6;
				const codeBlockStart = result.indexOf('{@code');
				if (codeBlockStart === NOT_FOUND_INDEX) {
					throw new Error(
						`Could not find {@code} block in result: ${result}`,
					);
				}

				/**
				 * Find the content after {@code (skip whitespace and newline).
				 */
				let contentStart = codeBlockStart + CODE_TAG_LENGTH;
				// Skip whitespace and newline after {@code
				while (
					contentStart < result.length &&
					(result[contentStart] === ' ' ||
						result[contentStart] === '\n')
				) {
					contentStart++;
				}
				// Check if this is a single-line code block: {@code ...} or {@code ...; }
				// Look for the closing } on the same line or next line
				const remainingText = result.slice(contentStart);
				const lines = remainingText.split('\n');
				let closingLineIndex = -1;
				const EMPTY_LINE_LENGTH = 0;
				const ARRAY_START_INDEX = 0;

				// First, check if this is a single-line code block: {@code ...} or {@code ...; }
				// Single-line format has the closing } on the same line as the content
				const firstLine = lines[ARRAY_START_INDEX] ?? '';
				// Match single-line format: content followed by optional space and }
				// Handle both: "content}" and "content }" and "content; }"
				// The pattern captures content up to (but not including) the closing }
				// We need to handle: "content}" and "content }" and "content; }"
				const singleLineMatch = /^(.+?)\s*\}\s*$/.exec(firstLine);
				if (singleLineMatch && !firstLine.includes('\n')) {
					// Single-line code block - extract content directly
					// The content might have trailing space before }, so trim it
					let codeBlockContent = singleLineMatch[1]?.trimEnd() ?? '';
					const ZERO_LENGTH = 0;
					if (codeBlockContent.length > ZERO_LENGTH) {
						expect(codeBlockContent).toBe(expectedCode);
					} else {
						throw new Error(
							`Code block content is empty in result: ${result}`,
						);
					}
					return;
				}

				// Multiline format: find the closing } that's on a line with just whitespace, asterisk, space, and } (no semicolon)
				// This distinguishes the closing } of {@code} from the }; in the code
				// Look for pattern: \n   * } (newline, spaces, asterisk, space, }, but NOT };)
				// Find the LAST occurrence, not the first, since there may be multiple } in the code
				for (let i = lines.length - 1; i >= EMPTY_LINE_LENGTH; i--) {
					const line = lines[i];
					// Match line with just whitespace, asterisk, space, and } (not };)
					if (/^\s*\*\s*\}$/.test(line)) {
						closingLineIndex = i;
						break;
					}
				}
				if (closingLineIndex === NOT_FOUND_INDEX) {
					throw new Error(
						`Could not find closing } for {@code} block in result: ${result}`,
					);
				}
				// Get all lines up to (but not including) the closing line
				const codeBlockLines = lines.slice(
					ARRAY_START_INDEX,
					closingLineIndex,
				);
				const codeBlockContent = codeBlockLines.join('\n');
				const ZERO_LENGTH = 0;
				if (codeBlockContent.length > ZERO_LENGTH) {
					// Remove comment prefixes (like "   * ") from each line
					const codeLines = codeBlockContent
						.split('\n')
						.map((line) => line.replace(/^\s*\*\s?/, '').trimEnd())
						.filter(
							(line) =>
								line.length > ZERO_LENGTH ||
								codeBlockContent.includes('\n'),
						);
					const formattedCode = codeLines.join('\n').trim();
					expect(formattedCode).toBe(expectedCode);
				} else {
					throw new Error(
						`Code block content is empty in result: ${result}`,
					);
				}
			},
		);
	});

	describe('ApexDoc annotation normalization', () => {
		it.concurrent.each([
			{
				description:
					'should normalize ApexDoc annotations to lowercase and group names to proper case',
				fixture: 'apexdoc-annotation-normalization',
			},
			{
				description:
					'should handle multiple annotations on same line, inconsistent spacing, code blocks between annotations, and comprehensive casing',
				fixture: 'apexdoc-annotation-comprehensive',
			},
			{
				description:
					'should wrap long ApexDoc annotation lines based on printWidth setting',
				fixture: 'apexdoc-printwidth-wrapping',
			},
			{
				description:
					'should normalize @deprecated to @Deprecated inside {@code} blocks but keep @deprecated lowercase in ApexDoc annotations',
				fixture: 'apexdoc-code-block-deprecated',
			},
			{
				description:
					'should handle complex test class inside {@code} block with @IsTest, inner classes, helper methods, @example annotation with long description, and printWidth wrapping',
				fixture: 'apexdoc-complex-test-class',
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

	describe('ApexDoc malformed comment blocks', () => {
		it.concurrent.each([
			{
				description:
					'should normalize ApexDoc comments with missing asterisks on some lines',
				fixture: 'apexdoc-malformed-no-asterisks',
			},
			{
				description:
					'should normalize ApexDoc comments with missing asterisks and code blocks',
				fixture: 'apexdoc-malformed-no-asterisks-code',
			},
			{
				description:
					'should normalize ApexDoc comments with inconsistent indentation',
				fixture: 'apexdoc-malformed-inconsistent-indent',
			},
			{
				description:
					'should normalize ApexDoc comments with inconsistent indentation and code blocks',
				fixture: 'apexdoc-malformed-inconsistent-indent-code',
			},
			{
				description:
					'should normalize ApexDoc comments with extra asterisks on lines',
				fixture: 'apexdoc-malformed-extra-asterisks-start',
			},
			{
				description:
					'should normalize ApexDoc comments with extra asterisks and code blocks',
				fixture: 'apexdoc-malformed-extra-asterisks-start-code',
			},
			{
				description:
					'should normalize ApexDoc comments with extra asterisks before closing',
				fixture: 'apexdoc-malformed-extra-asterisks-end',
			},
			{
				description:
					'should normalize ApexDoc comments with extra asterisks before closing and code blocks',
				fixture: 'apexdoc-malformed-extra-asterisks-end-code',
			},
			{
				description:
					'should normalize ApexDoc comments with multiple asterisks at line start',
				fixture: 'apexdoc-malformed-multiple-asterisks',
			},
			{
				description:
					'should normalize ApexDoc comments with multiple asterisks and code blocks',
				fixture: 'apexdoc-malformed-multiple-asterisks-code',
			},
			{
				description:
					'should normalize ApexDoc comments with inconsistent asterisk spacing',
				fixture: 'apexdoc-malformed-asterisk-spacing',
			},
			{
				description:
					'should normalize ApexDoc comments with inconsistent asterisk spacing and code blocks',
				fixture: 'apexdoc-malformed-asterisk-spacing-code',
			},
			{
				description:
					'should normalize ApexDoc comments with mixed malformations',
				fixture: 'apexdoc-malformed-mixed',
			},
			{
				description:
					'should normalize ApexDoc comments with mixed malformations and code blocks',
				fixture: 'apexdoc-malformed-mixed-code',
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
