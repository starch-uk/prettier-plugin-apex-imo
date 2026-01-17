/**
 * @file Unit tests for the apexdoc-annotations module.
 */

import { describe, it, expect } from 'vitest';
import type { Doc } from 'prettier';
import {
	renderAnnotation,
	wrapAnnotations,
	detectAnnotationsInDocs,
	normalizeAnnotations,
} from '../src/apexdoc-annotations.js';
import type { ApexDocAnnotation, ApexDocComment } from '../src/comments.js';

describe('apexdoc-annotations', () => {
	describe('renderAnnotation', () => {
		it.concurrent('should render annotation with followingText', () => {
			// Test followingText handling
			const doc: ApexDocAnnotation = {
				content: 'input The input parameter' as Doc,
				followingText: 'Some text before annotation' as Doc,
				name: 'param',
				type: 'annotation',
			};
			const result = renderAnnotation(doc, '   * ');
			expect(result).not.toBeNull();
			expect(result.lines).toContain('   * Some text before annotation');
			expect(result.lines.some((l) => l.includes('@param'))).toBe(true);
		});

		it.concurrent(
			'should render annotation with multiline followingText',
			() => {
				// Test followingText with multiple lines
				const doc: ApexDocAnnotation = {
					content: 'input The input parameter' as Doc,
					followingText: 'Line 1\nLine 2' as Doc,
					name: 'param',
					type: 'annotation',
				};
				const result = renderAnnotation(doc, '   * ');
				expect(result).not.toBeNull();
				expect(result.lines).toContain('   * Line 1');
				expect(result.lines).toContain('   * Line 2');
			},
		);

		it.concurrent('should handle empty line in annotation content', () => {
			// Test empty line in annotation content
			const doc: ApexDocAnnotation = {
				content: 'input The input\n\nMore content' as Doc,
				name: 'param',
				type: 'annotation',
			};
			const result = renderAnnotation(doc, '   * ');
			expect(result).not.toBeNull();
			// Should have trimmed comment prefix for empty line
			expect(result.lines.some((l) => l.trim() === '*')).toBe(true);
		});

		it.concurrent('should render simple annotation', () => {
			// Covers non-empty firstContent (ternary true branch in renderAnnotation)
			const doc: ApexDocAnnotation = {
				content: 'input The input parameter' as Doc,
				name: 'param',
				type: 'annotation',
			};
			const result = renderAnnotation(doc, '   * ');
			expect(result).not.toBeNull();
			expect(result.lines[0]).toContain('@param');
			expect(result.lines[0]).toContain('input The input parameter');
		});

		it.concurrent('should render annotation with empty content', () => {
			const doc: ApexDocAnnotation = {
				content: '' as Doc,
				name: 'deprecated',
				type: 'annotation',
			};
			const result = renderAnnotation(doc, '   * ');
			expect(result).not.toBeNull();
			expect(result.lines[0]).toBe('   * @deprecated');
		});
	});

	describe('wrapAnnotations', () => {
		it.concurrent(
			'should skip annotation when firstLineAvailableWidth <= 0',
			() => {
				// Test early return when no space available
				// firstLineAvailableWidth = printWidth - (actualPrefixLength + annotationPrefixLength)
				// Since printWidth = effectiveWidth + actualPrefixLength,
				// firstLineAvailableWidth = effectiveWidth - annotationPrefixLength
				// For @param, annotationPrefixLength = 7 (@param )
				// So we need effectiveWidth <= 7 to trigger the condition
				const doc: ApexDocAnnotation = {
					content: 'input The input parameter' as Doc,
					name: 'param',
					type: 'annotation',
				};
				const docs: ApexDocComment[] = [doc];
				// Set effectiveWidth to 5, which is less than '@param '.length (7)
				// This makes firstLineAvailableWidth = 5 - 7 = -2 <= 0
				const effectiveWidth = 5;
				const actualPrefixLength = 5;

				const result = wrapAnnotations(
					docs,
					effectiveWidth,
					0,
					actualPrefixLength,
					{ tabWidth: 2, useTabs: false },
				);
				expect(result).toHaveLength(1);
				// Should return doc unchanged when no space
				expect(result[0]?.type).toBe('annotation');
				if (result[0]?.type === 'annotation') {
					expect(result[0].name).toBe(doc.name);
					expect(result[0].content).toBe(doc.content);
				}
			},
		);

		it.concurrent('should wrap long annotation content', () => {
			const doc: ApexDocAnnotation = {
				content:
					'input This is a very long parameter description that should wrap to multiple lines' as Doc,
				name: 'param',
				type: 'annotation',
			};
			const docs: ApexDocComment[] = [doc];
			const result = wrapAnnotations(docs, 40, 0, 5, {
				tabWidth: 2,
				useTabs: false,
			});
			expect(result).toHaveLength(1);
			expect(result[0]?.type).toBe('annotation');
		});

		it.concurrent('should handle annotation with empty content', () => {
			const doc: ApexDocAnnotation = {
				content: '' as Doc,
				name: 'deprecated',
				type: 'annotation',
			};
			const docs: ApexDocComment[] = [doc];
			const result = wrapAnnotations(docs, 80, 0, 5, {
				tabWidth: 2,
				useTabs: false,
			});
			expect(result).toHaveLength(1);
			expect(result[0]?.type).toBe('annotation');
		});

		it.concurrent.each([{ useTabs: null }, { useTabs: undefined }])(
			'should handle useTabs $useTabs',
			({ useTabs }: Readonly<{ useTabs: null | undefined }>) => {
				// Test useTabsOption ternary with null/undefined
				const doc: ApexDocAnnotation = {
					content: 'input The input parameter' as Doc,
					name: 'param',
					type: 'annotation',
				};
				const docs: ApexDocComment[] = [doc];
				const result = wrapAnnotations(docs, 80, 0, 5, {
					tabWidth: 2,
					useTabs,
				});
				expect(result).toHaveLength(1);
			},
		);

		it.concurrent(
			'should handle first word too long for first line',
			() => {
				// Test allLines ternary when firstLineContent is empty
				// This happens when first word doesn't fit on first line (firstLineWords.length === 0)
				const doc: ApexDocAnnotation = {
					content:
						'SuperLongWordThatDoesNotFitOnFirstLine more content here' as Doc,
					name: 'param',
					type: 'annotation',
				};
				const docs: ApexDocComment[] = [doc];
				// Set very small width so first word doesn't fit
				const result = wrapAnnotations(docs, 10, 0, 5, {
					tabWidth: 2,
					useTabs: false,
				});
				expect(result).toHaveLength(1);
				expect(result[0]?.type).toBe('annotation');
			},
		);

		it.concurrent('should pass through non-annotation docs', () => {
			const textDoc: ApexDocComment = {
				content: 'Some text',
				lines: ['Some text'],
				type: 'text',
			};
			const docs: ApexDocComment[] = [textDoc];
			const result = wrapAnnotations(docs, 80, 0, 5, {
				tabWidth: 2,
				useTabs: false,
			});
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(textDoc);
		});
	});

	describe('detectAnnotationsInDocs', () => {
		it.concurrent('should detect annotations in text docs', () => {
			const textDoc: ApexDocComment = {
				content: '   * @param input The input',
				lines: ['   * @param input The input'],
				type: 'text',
			};
			const docs: ApexDocComment[] = [textDoc];
			const result = detectAnnotationsInDocs(docs);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]?.type).toBe('annotation');
			if (result[0]?.type === 'annotation') {
				expect(result[0].name).toBe('param');
			}
		});

		it.concurrent(
			'should collect continuation lines for annotation',
			() => {
				// Test continuation lines in collectContinuationFromDocLines
				const textDoc: ApexDocComment = {
					content:
						'   * @param input The input\n   * continuation line',
					lines: [
						'   * @param input The input',
						'   * continuation line',
					],
					type: 'text',
				};
				const docs: ApexDocComment[] = [textDoc];
				const result = detectAnnotationsInDocs(docs);
				expect(result.length).toBeGreaterThan(0);
				const annotations = result.filter(
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
					(d) => d.type === 'annotation',
				);
				expect(annotations.length).toBeGreaterThanOrEqual(1);
				if (annotations[0]?.type === 'annotation') {
					// Should include continuation line in content
					// eslint-disable-next-line @typescript-eslint/no-base-to-string -- content is Doc type, needs stringification for test
					const contentString = String(annotations[0].content);
					expect(contentString).toContain('continuation line');
				}
			},
		);

		it.concurrent('should handle annotation with beforeText', () => {
			// Test followingText when beforeText is non-empty
			// This covers the ternary true branch and spread operator
			const textDoc: ApexDocComment = {
				content: '   * Some text before @param input The input',
				lines: ['   * Some text before @param input The input'],
				type: 'text',
			};
			const docs: ApexDocComment[] = [textDoc];
			const result = detectAnnotationsInDocs(docs);
			expect(result.length).toBeGreaterThan(0);
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
			const annotations = result.filter((d) => d.type === 'annotation');
			expect(annotations.length).toBeGreaterThanOrEqual(1);
			if (annotations[0]?.type === 'annotation') {
				// Should have followingText when beforeText is non-empty
				expect(annotations[0].followingText).toBeDefined();
				const followingTextString = String(
					// eslint-disable-next-line @typescript-eslint/no-base-to-string -- followingText is Doc type, needs stringification for test
					annotations[0].followingText,
				);
				expect(followingTextString).toContain('Some text before');
			}
		});

		it.concurrent('should handle doc when docLinesToCheck is empty', () => {
			// Test when docLinesToCheck.length === 0
			// This happens when all lines are empty, start with @, or start with {@code}
			// When docLinesToCheck.length === 0, we skip the check and push the doc
			const textDoc: ApexDocComment = {
				content: '   * \n   * ',
				lines: ['   * ', '   * '],
				type: 'text',
			};
			const docs: ApexDocComment[] = [textDoc];
			const result = detectAnnotationsInDocs(docs);
			// When docLinesToCheck.length === 0, we skip the consumed check and push doc
			expect(result.length).toBe(1);
			expect(result[0]).toEqual(textDoc);
		});

		it.concurrent(
			'should skip doc when all processed lines filtered out',
			() => {
				// Test when trimmedLines.length === 0 after filtering
				// This happens when hasAnnotations === true, processedLines.length > 0,
				// but all processedLines are empty or consumed after filtering
				// Create a doc with annotations and empty lines in processedLines
				const textDoc: ApexDocComment = {
					content: '   * \n   * @param input The input\n   * ',
					lines: ['   * ', '   * @param input The input', '   * '],
					type: 'text',
				};
				const docs: ApexDocComment[] = [textDoc];
				const result = detectAnnotationsInDocs(docs);
				// processedLines contains empty lines, which get filtered out
				// So trimmedLines.length === 0 and we don't push a new doc
				const annotations = result.filter(
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
					(d) => d.type === 'annotation',
				);
				expect(annotations.length).toBeGreaterThan(0);
				// Should not have a text doc for the empty processedLines
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
				const textDocs = result.filter((d) => d.type === 'text');
				// The empty lines in processedLines are filtered out, so no text doc should be created
				expect(textDocs.length).toBe(0);
			},
		);

		it.concurrent('should handle paragraph docs with annotations', () => {
			const paragraphDoc: ApexDocComment = {
				content: '   * @param input The input\n   * @return The result',
				lines: [
					'   * @param input The input',
					'   * @return The result',
				],
				type: 'paragraph',
			};
			const docs: ApexDocComment[] = [paragraphDoc];
			const result = detectAnnotationsInDocs(docs);
			expect(result.length).toBeGreaterThan(0);
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
			const annotations = result.filter((d) => d.type === 'annotation');
			expect(annotations.length).toBeGreaterThanOrEqual(1);
		});

		it.concurrent(
			'should create text doc from remaining processed lines',
			() => {
				// Test creating text doc from processedLines
				// This happens when some lines have annotations and some don't
				const textDoc: ApexDocComment = {
					content:
						'   * Some text\n   * @param input The input\n   * More text',
					lines: [
						'   * Some text',
						'   * @param input The input',
						'   * More text',
					],
					type: 'text',
				};
				const docs: ApexDocComment[] = [textDoc];
				const result = detectAnnotationsInDocs(docs);
				// Should have annotation plus remaining text
				const annotations = result.filter(
					// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
					(d) => d.type === 'annotation',
				);
				expect(annotations.length).toBeGreaterThanOrEqual(1);
				// Should have remaining text as a text doc
				// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
				const textDocs = result.filter((d) => d.type === 'text');
				expect(textDocs.length).toBeGreaterThan(0);
			},
		);

		it.concurrent('should pass through non-text docs', () => {
			const codeDoc: ApexDocComment = {
				content: 'System.debug("test");',
				rawCode: 'System.debug("test");',
				type: 'code',
			};
			const docs: ApexDocComment[] = [codeDoc];
			const result = detectAnnotationsInDocs(docs);
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(codeDoc);
		});

		it.concurrent('should skip empty lines in docLines', () => {
			// Test if (line === '') continue;
			// When docLines contains empty strings (from split('\n') on paragraph content with empty lines)
			// Use paragraph type so content is split('\n'), which can produce empty strings
			// Need consecutive newlines to produce an actual empty string: '   * \n\n   * @param'
			// splits to: ['   * ', '', '   * @param'] - the middle '' triggers the empty line check
			const paragraphDoc: ApexDocComment = {
				content: '   * \n\n   * @param input The input',
				lines: ['   * ', '', '   * @param input The input'],
				type: 'paragraph',
			};
			const docs: ApexDocComment[] = [paragraphDoc];
			const result = detectAnnotationsInDocs(docs);
			// Empty lines should be skipped, but annotations should still be detected
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
			const annotations = result.filter((d) => d.type === 'annotation');
			expect(annotations.length).toBeGreaterThan(0);
		});
	});

	describe('normalizeAnnotations', () => {
		it.concurrent('should normalize annotation names to lowercase', () => {
			const doc: ApexDocAnnotation = {
				content: 'input The input' as Doc,
				name: 'PARAM',
				type: 'annotation',
			};
			const docs: ApexDocComment[] = [doc];
			const result = normalizeAnnotations(docs);
			expect(result).toHaveLength(1);
			expect(result[0]?.type).toBe('annotation');
			if (result[0]?.type === 'annotation') {
				expect(result[0].name).toBe('param');
			}
		});

		it.concurrent(
			'should skip normalization for annotations not in set',
			() => {
				// Test annotation NOT in APEXDOC_ANNOTATIONS_SET
				// This covers the false branch of the if statement
				const doc: ApexDocAnnotation = {
					content: 'some content' as Doc,
					name: 'customannotation',
					type: 'annotation',
				};
				const docs: ApexDocComment[] = [doc];
				const result = normalizeAnnotations(docs);
				expect(result).toHaveLength(1);
				expect(result[0]?.type).toBe('annotation');
				if (result[0]?.type === 'annotation') {
					// Should not normalize (lowercase) if not in set
					expect(result[0].name).toBe('customannotation');
				}
			},
		);

		it.concurrent('should pass through non-annotation docs', () => {
			const textDoc: ApexDocComment = {
				content: 'Some text',
				lines: ['Some text'],
				type: 'text',
			};
			const docs: ApexDocComment[] = [textDoc];
			const result = normalizeAnnotations(docs);
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(textDoc);
		});
	});
});
