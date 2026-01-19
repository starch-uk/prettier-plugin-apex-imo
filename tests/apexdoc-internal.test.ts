/**
 * @file Unit tests for internal apexdoc functions to reach 100% coverage.
 */

import { describe, it, expect } from 'vitest';
import { detectCodeBlockDocs, __TEST_ONLY__ } from '../src/apexdoc.js';
import type { ApexDocComment } from '../src/comments.js';

describe('apexdoc internal functions', () => {
	describe('detectCodeBlockDocs', () => {
		it.concurrent(
			'should pass through non-text/non-paragraph docs (line 1046)',
			() => {
				const codeDoc: ApexDocComment = {
					code: 'test',
					endPos: 10,
					startPos: 0,
					type: 'code',
				};
				const annotationDoc: ApexDocComment = {
					content: 'test',
					name: 'param',
					type: 'annotation',
				};

				const result1 = detectCodeBlockDocs([codeDoc], '');
				expect(result1).toEqual([codeDoc]);

				const result2 = detectCodeBlockDocs([annotationDoc], '');
				expect(result2).toEqual([annotationDoc]);

				const result3 = detectCodeBlockDocs(
					[codeDoc, annotationDoc],
					'',
				);
				expect(result3).toEqual([codeDoc, annotationDoc]);
			},
		);
	});

	describe('processCodeLines', () => {
		it.concurrent(
			'should handle multiple consecutive blank lines in while loop (coverage for apexdoc.ts:278)',
			() => {
				const { processCodeLines } = __TEST_ONLY__;
				// Test code with multiple consecutive blank lines after semicolon
				// This ensures the while loop at line 278 executes multiple times
				const codeWithMultipleBlanks = [
					'public class Test {',
					'  private Integer field;',
					'',
					'',
					'',
					'',
					'  @Test',
					'  public void nextMethod() {}',
					'}',
				].join('\n');

				const result = processCodeLines(codeWithMultipleBlanks);
				expect(result).toBeDefined();
				expect(result).toContain('field;');
				expect(result).toContain('@Test');
			},
		);

		it.concurrent(
			'should handle semicolon followed only by blank lines until end (coverage for apexdoc.ts:282-283)',
			() => {
				const { processCodeLines } = __TEST_ONLY__;
				// Test code where semicolon is followed only by blank lines until the end
				// This ensures the false branch of line 282-283 is covered
				// (when nextNonBlankIndex >= codeLines.length after while loop exits)
				// The condition at line 264 (i < codeLines.length - INDEX_ONE) ensures we only
				// process lines that aren't the last line, so the semicolon must NOT be the last line
				// But all lines after the semicolon must be blank until the end
				const codeWithSemicolonThenOnlyBlanks = [
					'public class Test {', // Line 0
					'  private Integer field;', // Line 1 - ends with semicolon, i=1, nextNonBlankIndex=2
					'', // Line 2 - blank (nextNonBlankIndex=2)
					'', // Line 3 - blank (nextNonBlankIndex=3)
					'', // Line 4 - blank (nextNonBlankIndex=4)
					'}', // Line 5 - final line (ensures i=1 passes the check i < codeLines.length - 1)
				].join('\n');

				const result = processCodeLines(
					codeWithSemicolonThenOnlyBlanks,
				);
				expect(result).toBeDefined();
				expect(result).toContain('field;');
				expect(result).toContain('}');
			},
		);
	});
});
