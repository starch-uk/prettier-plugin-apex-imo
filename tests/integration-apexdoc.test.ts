/**
 * @file Integration tests for ApexDoc formatting in the plugin.
 */

import { describe, it, expect } from 'vitest';
import {
	loadFixture,
	formatApex,
	extractCodeBlockFromResult,
} from './test-utils.js';

describe('prettier-plugin-apex-imo integration', () => {
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
				const formattedCode = extractCodeBlockFromResult(result);
				expect(formattedCode).toBe(expectedCode);
			},
		);
	});

	describe('ApexDoc edge cases', () => {
		it.concurrent(
			'should handle empty block statement with leading comment',
			async () => {
				const input = loadFixture('comment-empty-block', 'input');
				const expected = loadFixture('comment-empty-block', 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);

		it.concurrent(
			'should handle end-of-line comment after non-binary expression',
			async () => {
				const input = loadFixture(
					'comment-end-of-line-after-literal',
					'input',
				);
				const expected = loadFixture(
					'comment-end-of-line-after-literal',
					'output',
				);
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);

		it.concurrent('should handle standalone brace', async () => {
			const input = loadFixture('apexdoc-standalone-brace', 'input');
			const expected = loadFixture('apexdoc-standalone-brace', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it.concurrent(
			'should handle incomplete code block that cannot be merged',
			async () => {
				const input = loadFixture(
					'apexdoc-incomplete-code-block-merge',
					'input',
				);
				const expected = loadFixture(
					'apexdoc-incomplete-code-block-merge',
					'output',
				);
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);

		it.concurrent('should handle code block that ends inline', async () => {
			const input = loadFixture(
				'apexdoc-code-block-ends-inline',
				'input',
			);
			const expected = loadFixture(
				'apexdoc-code-block-ends-inline',
				'output',
			);
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it.concurrent(
			'should handle text with newline before code block',
			async () => {
				const input = loadFixture(
					'apexdoc-code-with-newline-trailing',
					'input',
				);
				const expected = loadFixture(
					'apexdoc-code-with-newline-trailing',
					'output',
				);
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);

		it.concurrent(
			'should handle text with trailing newline before code block',
			async () => {
				const input = loadFixture(
					'apexdoc-text-trailing-newline-code-block',
					'input',
				);
				const expected = loadFixture(
					'apexdoc-text-trailing-newline-code-block',
					'output',
				);
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);

		it.concurrent('should skip empty line before code block', async () => {
			const input = loadFixture(
				'apexdoc-empty-line-before-code',
				'input',
			);
			const expected = loadFixture(
				'apexdoc-empty-line-before-code',
				'output',
			);
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it.concurrent(
			'should handle no remaining text after code block',
			async () => {
				const input = loadFixture(
					'apexdoc-no-remaining-text-after-code',
					'input',
				);
				const expected = loadFixture(
					'apexdoc-no-remaining-text-after-code',
					'output',
				);
				const result = await formatApex(input);
				expect(result).toBe(expected);
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
			{
				description:
					'should handle malformed code block where extraction fails',
				fixture: 'apexdoc-malformed-code-extraction-fails',
			},
			{
				description: 'should handle code block with no text before it',
				fixture: 'apexdoc-code-no-text-before',
			},
			{
				description: 'should handle consecutive code blocks',
				fixture: 'apexdoc-consecutive-code-blocks',
			},
			{
				description:
					'should handle code block ending with only whitespace',
				fixture: 'apexdoc-code-block-ending-inline',
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

	describe('ApexDoc code block edge cases', () => {
		it.concurrent(
			'should handle code block ending on separate line after nested braces',
			async () => {
				const input = loadFixture(
					'apexdoc-code-block-multi-line-ending',
					'input',
				);
				const expected = loadFixture(
					'apexdoc-code-block-multi-line-ending',
					'output',
				);
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);

		it.concurrent(
			'should handle standalone closing brace line',
			async () => {
				const input = loadFixture(
					'apexdoc-standalone-closing-brace',
					'input',
				);
				const expected = loadFixture(
					'apexdoc-standalone-closing-brace',
					'output',
				);
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('Non-ApexDoc block comments', () => {
		it.concurrent(
			'should normalize annotations in non-ApexDoc block comments',
			async () => {
				const input = loadFixture('block-comment-non-apexdoc', 'input');
				const expected = loadFixture(
					'block-comment-non-apexdoc',
					'output',
				);
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);

		it.concurrent('should handle empty block comment', async () => {
			const input = loadFixture('block-comment-empty-content', 'input');
			const expected = loadFixture(
				'block-comment-empty-content',
				'output',
			);
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});
	});
});
