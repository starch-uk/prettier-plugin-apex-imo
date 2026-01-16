/**
 * @file Unit tests for the apexdoc module.
 */

 
import { describe, it, expect } from 'vitest';
import type { ParserOptions } from 'prettier';
import { EMPTY_CODE_TAG } from '../src/apexdoc.js';
import { loadFixture, formatApex } from './test-utils.js';

describe('apexdoc', () => {
	describe('EMPTY_CODE_TAG', () => {
		it.concurrent('should be {@code}', () => {
			expect(EMPTY_CODE_TAG).toBe('{@code}');
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
});
