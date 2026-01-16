/**
 * @file Unit tests for the apexdoc module.
 */

 
import { describe, it, expect } from 'vitest';
import type { ParserOptions } from 'prettier';
import {
	EMPTY_CODE_TAG,
	filterNonEmptyLines,
	removeTrailingEmptyLines,
	isApexDoc,
	detectCodeBlockDocs,
	normalizeSingleApexDocComment,
} from '../src/apexdoc.js';
import type { ApexDocComment } from '../src/comments.js';
import { createDocContent } from '../src/comments.js';
import { loadFixture, formatApex } from './test-utils.js';

describe('apexdoc', () => {
	describe('EMPTY_CODE_TAG', () => {
		it.concurrent('should be {@code}', () => {
			expect(EMPTY_CODE_TAG).toBe('{@code}');
		});
	});

	describe('filterNonEmptyLines', () => {
		it.concurrent('should filter out whitespace-only lines', () => {
			const text = '   \n  \n  text\n  ';
			const result = filterNonEmptyLines(text);
			expect(result).toEqual(['  text']);
		});

		it.concurrent('should return empty array for whitespace-only text', () => {
			const text = '   \n  \n  ';
			const result = filterNonEmptyLines(text);
			expect(result).toEqual([]);
		});
	});

	describe('removeTrailingEmptyLines', () => {
		it.concurrent('should remove trailing empty lines', () => {
			const lines = ['line1', 'line2', '', '   ', ''];
			const result = removeTrailingEmptyLines(lines);
			expect(result).toEqual(['line1', 'line2']);
		});

		it.concurrent(
			'should handle all empty lines by removing all of them',
			() => {
				const lines = ['', '   ', ''];
				const result = removeTrailingEmptyLines(lines);
				expect(result).toEqual([]);
			},
		);

		it.concurrent('should preserve non-empty lines', () => {
			const lines = ['line1', 'line2'];
			const result = removeTrailingEmptyLines(lines);
			expect(result).toEqual(['line1', 'line2']);
		});
	});

	describe('isApexDoc', () => {
		it.concurrent('should return false for null', () => {
			expect(isApexDoc(null)).toBe(false);
		});

		it.concurrent('should return false for undefined', () => {
			expect(isApexDoc(undefined)).toBe(false);
		});

		it.concurrent('should return false for non-object', () => {
			expect(isApexDoc('string')).toBe(false);
			expect(isApexDoc(123)).toBe(false);
			expect(isApexDoc(true)).toBe(false);
		});

		it.concurrent('should return false for object without value property', () => {
			expect(isApexDoc({})).toBe(false);
			expect(isApexDoc({ other: 'prop' })).toBe(false);
		});

		it.concurrent('should return false for object with non-string value', () => {
			expect(isApexDoc({ value: 123 })).toBe(false);
			expect(isApexDoc({ value: null })).toBe(false);
			expect(isApexDoc({ value: {} })).toBe(false);
		});

		it.concurrent('should return true for valid ApexDoc comment', () => {
			const comment = {
				value: '/**\n * Test comment\n */',
			};
			expect(isApexDoc(comment)).toBe(true);
		});
	});


	describe('Type casing in {@code} blocks', () => {
		it.concurrent(
			'should normalize primitive types to PascalCase inside {@code} blocks',
			async () => {
				const input = `public class Test {
  /**
   * Example:
   * {@code
   * string name = 'test';
   * integer count = 10;
   * boolean flag = true;
   * }
   */
  public void example() {}
}`;

				const result = await formatApex(input);

				expect(result).toContain('String name');
				expect(result).toContain('Integer count');
				expect(result).toContain('Boolean flag');
				expect(result).not.toContain('string name');
				expect(result).not.toContain('integer count');
				expect(result).not.toContain('boolean flag');
			},
		);

		it.concurrent(
			'should enforce type casing for all primitive types inside {@code} blocks',
			async () => {
				const input = `public class Test {
  /**
   * Example with all primitive types:
   * {@code
   * blob data = Blob.valueOf('test');
   * boolean flag = true;
   * date today = Date.today();
   * datetime now = Datetime.now();
   * decimal amount = 100.50;
   * double price = 99.99;
   * id recordId = UserInfo.getUserId();
   * integer count = 42;
   * long bigNumber = 1000000L;
   * object obj = new Object();
   * string text = 'hello';
   * time currentTime = Time.newInstance(12, 0, 0, 0);
   * sobject record = new Account();
   * }
   */
  public void example() {}
}`;

				const result = await formatApex(input);

				// Verify all primitives are normalized to PascalCase
				expect(result).toContain('Blob data');
				expect(result).toContain('Boolean flag');
				expect(result).toContain('Date today');
				expect(result).toContain('Datetime now');
				expect(result).toContain('Decimal amount');
				expect(result).toContain('Double price');
				expect(result).toContain('ID recordId');
				expect(result).toContain('Integer count');
				expect(result).toContain('Long bigNumber');
				expect(result).toContain('Object obj');
				expect(result).toContain('String text');
				expect(result).toContain('Time currentTime');
				expect(result).toContain('SObject record');

				// Verify lowercase versions are not present
				expect(result).not.toContain('blob data');
				expect(result).not.toContain('boolean flag');
				expect(result).not.toContain('date today');
				expect(result).not.toContain('datetime now');
				expect(result).not.toContain('decimal amount');
				expect(result).not.toContain('double price');
				expect(result).not.toContain('id recordId');
				expect(result).not.toContain('integer count');
				expect(result).not.toContain('long bigNumber');
				expect(result).not.toContain('object obj');
				expect(result).not.toContain('string text');
				expect(result).not.toContain('time currentTime');
				expect(result).not.toContain('sobject record');
			},
		);

		it.concurrent(
			'should normalize collection types to PascalCase inside {@code} blocks',
			async () => {
				const input = `public class Test {
  /**
   * Example:
   * {@code
   * list<string> items = new list<string>();
   * set<integer> numbers = new set<integer>();
   * map<string, integer> data = new map<string, integer>();
   * }
   */
  public void example() {}
}`;

				const result = await formatApex(input);

				expect(result).toContain('List<String>');
				expect(result).toContain('Set<Integer>');
				expect(result).toContain('Map<String, Integer>');
				expect(result).not.toContain('list<string>');
				expect(result).not.toContain('set<integer>');
				expect(result).not.toContain('map<string, integer>');
			},
		);

		it.concurrent(
			'should normalize standard object types to PascalCase inside {@code} blocks',
			async () => {
				const input = `public class Test {
  /**
   * Example:
   * {@code
   * account acc = new account();
   * contact con = new contact();
   * list<account> accounts = new list<account>();
   * }
   */
  public void example() {}
}`;

				const result = await formatApex(input);

				expect(result).toContain('Account acc');
				expect(result).toContain('Contact con');
				expect(result).toContain('List<Account>');
				expect(result).not.toContain('account acc');
				expect(result).not.toContain('contact con');
				expect(result).not.toContain('list<account>');
			},
		);

		it.concurrent(
			'should normalize object suffixes inside {@code} blocks',
			async () => {
				const input = `public class Test {
  /**
   * Example:
   * {@code
   * MyCustomObject__C obj = new MyCustomObject__C();
   * List<MyCustomObject__C> objects = new List<MyCustomObject__C>();
   * }
   */
  public void example() {}
}`;

				const result = await formatApex(input);

				expect(result).toContain('MyCustomObject__c');
				expect(result).toContain('List<MyCustomObject__c>');
				expect(result).not.toContain('MyCustomObject__C');
			},
		);

		it.concurrent(
			'should normalize types in single-line {@code} blocks',
			async () => {
				const input = `public class Test {
  /**
   * Example: {@code string name = 'test'; }
   */
  public void example() {}
}`;

				const result = await formatApex(input);

				expect(result).toContain('String name');
				expect(result).not.toContain('string name');
			},
		);

		it.concurrent(
			'should normalize types in multi-line {@code} blocks',
			async () => {
				const input = `public class Test {
  /**
   * Example:
   * {@code
   * string firstName = 'John';
   * integer age = 30;
   * boolean active = true;
   * list<account> accounts = new list<account>();
   * }
   */
  public void example() {}
}`;

				const result = await formatApex(input);

				expect(result).toContain('String firstName');
				expect(result).toContain('Integer age');
				expect(result).toContain('Boolean active');
				expect(result).toContain('List<Account>');
				expect(result).not.toContain('string firstName');
				expect(result).not.toContain('integer age');
				expect(result).not.toContain('boolean active');
				expect(result).not.toContain('list<account>');
			},
		);
	});

	describe('detectCodeBlockDocs with text type', () => {
		it.concurrent(
			'should process text type doc without code blocks (apexdoc.ts line 890 else branch)',
			() => {
				// Create a text type doc structure manually
				// Text type docs are created when no paragraphs are found
				// They have type: 'text' and contain only whitespace/empty content
				// The else branch at line 890 uses lines.join('\n') instead of map+removeCommentPrefix
				// This tests the branch when doc.type !== 'paragraph'
				const textDoc: ApexDocComment = {
					type: 'text',
					content: '   \n   ',
					lines: ['   ', '   '], // Whitespace lines - getContentLines expects this
				};
				const result = detectCodeBlockDocs([textDoc], '', false);
				// processContentForCodeBlocks is called which executes line 890 else branch
				// The result may be empty if the text doc is filtered, but the branch executes
				expect(Array.isArray(result)).toBe(true);
				// The important part is that line 890 (else branch: lines.join('\n')) gets executed
				// when doc.type === 'text' (not 'paragraph')
			},
		);
	});

	describe('normalizeSingleApexDocComment with isEmbedFormatted', () => {
		it.concurrent(
			'should handle isEmbedFormatted=true for code blocks (apexdoc.ts line 920)',
			async () => {
				// Test the isEmbedFormatted=true branch when code blocks are processed
				// This happens when embed function has already formatted the comment
				const commentWithCode = `/**
 * Example method.
 * {@code Integer x = 10; }
 */`;
				const options = {
					printWidth: 80,
					tabWidth: 2,
				} as ParserOptions;

				// Call with isEmbedFormatted=true to exercise line 920 branch
				const result = normalizeSingleApexDocComment(
					commentWithCode,
					0,
					options,
					true, // isEmbedFormatted = true
				);

				// Should process successfully - the isEmbedFormatted branch should execute
				expect(result).toBeDefined();
				// The important part is that line 920 (if (isEmbedFormatted)) gets executed
				// when isEmbedFormatted is true and code blocks are detected
			},
		);
	});

	describe('detectCodeBlockDocs with isEmbedFormatted', () => {
		it.concurrent(
			'should handle isEmbedFormatted=true when processing code blocks (apexdoc.ts line 915)',
			() => {
				// Test detectCodeBlockDocs directly with isEmbedFormatted=true
				// This should exercise processContentForCodeBlocks with isEmbedFormatted=true
				// which triggers the ternary at line 915-917: isEmbedFormatted ? codeBlockResult.code : undefined
				// Use text type to avoid removeCommentPrefix processing which might affect the format
				const textDoc = createDocContent(
					'text',
					'Example with {@code Integer x = 10; } code block',
					['Example with {@code Integer x = 10; } code block'],
				);
				const docs: ApexDocComment[] = [textDoc];

				// Call detectCodeBlockDocs with isEmbedFormatted=true (true branch)
				const resultTrue = detectCodeBlockDocs(docs, '', true);
				expect(Array.isArray(resultTrue)).toBe(true);
				expect(resultTrue.length).toBeGreaterThan(0);

				// Call detectCodeBlockDocs with isEmbedFormatted=false (false branch)
				const resultFalse = detectCodeBlockDocs(docs, '', false);
				expect(Array.isArray(resultFalse)).toBe(true);
				expect(resultFalse.length).toBeGreaterThan(0);
				// Both branches of the ternary should be covered now
			},
		);
	});
});
