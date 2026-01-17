/**
 * @file Integration tests for ApexDoc formatting in the plugin.
 */

import { describe, it, expect } from 'vitest';
import { loadFixture, formatApex } from './test-utils.js';

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

	describe('ApexDoc edge cases', () => {
		it.concurrent(
			'should handle empty block statement with leading comment (comments.ts line 181)',
			async () => {
				const input = loadFixture('comment-empty-block', 'input');
				const expected = loadFixture('comment-empty-block', 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);

		it.concurrent(
			'should handle end-of-line comment after non-binary expression (comments.ts line 212)',
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

		it.concurrent(
			'should handle standalone brace (apexdoc-code.ts line 146)',
			async () => {
				const input = loadFixture('apexdoc-standalone-brace', 'input');
				const expected = loadFixture(
					'apexdoc-standalone-brace',
					'output',
				);
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);

		it.concurrent(
			'should handle incomplete code block that cannot be merged (apexdoc.ts line 731)',
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

		it.concurrent(
			'should handle code block that ends inline (apexdoc-code.ts lines 138-142)',
			async () => {
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
			},
		);

		it.concurrent(
			'should handle text with newline before code block (comments.ts lines 882-887)',
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
			'should handle text with trailing newline before code block (comments.ts lines 882-887)',
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

		it.concurrent(
			'should skip empty line before code block (comments.ts line 896)',
			async () => {
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
			},
		);

		it.concurrent(
			'should handle no remaining text after code block (apexdoc.ts line 929)',
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
					'should handle malformed code block where extraction fails (apexdoc.ts lines 1021-1022)',
				fixture: 'apexdoc-malformed-code-extraction-fails',
			},
			{
				description:
					'should handle code block with no text before it (apexdoc.ts line 956)',
				fixture: 'apexdoc-code-no-text-before',
			},
			{
				description:
					'should handle consecutive code blocks (apexdoc.ts line 954)',
				fixture: 'apexdoc-consecutive-code-blocks',
			},
			{
				description:
					'should handle code block ending with only whitespace (apexdoc.ts line 929)',
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
			'should handle code block ending on separate line after nested braces (apexdoc-code.ts lines 138-142)',
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
			'should handle standalone closing brace line (apexdoc-code.ts line 146)',
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
			'should normalize annotations in non-ApexDoc block comments (comments.ts lines 1051-1065)',
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

		it.concurrent(
			'should handle empty block comment (comments.ts lines 828-834)',
			async () => {
				const input = loadFixture(
					'block-comment-empty-content',
					'input',
				);
				const expected = loadFixture(
					'block-comment-empty-content',
					'output',
				);
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});
});
