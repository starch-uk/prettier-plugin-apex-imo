/**
 * @file Unit tests for internal apexdoc functions to reach 100% coverage.
 */

import { describe, it, expect } from 'vitest';
import { detectCodeBlockDocs } from '../src/apexdoc.js';
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
});
