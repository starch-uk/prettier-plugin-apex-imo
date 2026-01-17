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
		it.concurrent('should render annotation with followingText (line 356)', () => {
			// Test line 356: followingText handling
			const doc: ApexDocAnnotation = {
				type: 'annotation',
				name: 'param',
				content: 'input The input parameter' as Doc,
				followingText: 'Some text before annotation' as Doc,
			};
			const result = renderAnnotation(doc, '   * ');
			expect(result).not.toBeNull();
			expect(result?.lines).toContain('   * Some text before annotation');
			expect(result?.lines.some((l) => l.includes('@param'))).toBe(true);
		});

		it.concurrent(
			'should render annotation with multiline followingText (line 356)',
			() => {
				// Test line 356: followingText with multiple lines
				const doc: ApexDocAnnotation = {
					type: 'annotation',
					name: 'param',
					content: 'input The input parameter' as Doc,
					followingText: 'Line 1\nLine 2' as Doc,
				};
				const result = renderAnnotation(doc, '   * ');
				expect(result).not.toBeNull();
				expect(result?.lines).toContain('   * Line 1');
				expect(result?.lines).toContain('   * Line 2');
			},
		);

		it.concurrent(
			'should handle empty line in annotation content (line 374)',
			() => {
				// Test line 374: empty line in annotation content
				const doc: ApexDocAnnotation = {
					type: 'annotation',
					name: 'param',
					content: 'input The input\n\nMore content' as Doc,
				};
				const result = renderAnnotation(doc, '   * ');
				expect(result).not.toBeNull();
				// Should have trimmed comment prefix for empty line
				expect(result?.lines.some((l) => l.trim() === '*')).toBe(true);
			},
		);

		it.concurrent('should render simple annotation', () => {
			const doc: ApexDocAnnotation = {
				type: 'annotation',
				name: 'param',
				content: 'input The input parameter' as Doc,
			};
			const result = renderAnnotation(doc, '   * ');
			expect(result).not.toBeNull();
			expect(result?.lines[0]).toContain('@param');
			expect(result?.lines[0]).toContain('input The input parameter');
		});

		it.concurrent('should render annotation with empty content', () => {
			const doc: ApexDocAnnotation = {
				type: 'annotation',
				name: 'deprecated',
				content: '' as Doc,
			};
			const result = renderAnnotation(doc, '   * ');
			expect(result).not.toBeNull();
			expect(result?.lines[0]).toBe('   * @deprecated');
		});
	});

	describe('wrapAnnotations', () => {
		it.concurrent(
			'should skip annotation when firstLineAvailableWidth <= 0 (lines 424-425)',
			() => {
				// Test lines 424-425: early return when no space available
				// firstLineAvailableWidth = printWidth - (actualPrefixLength + annotationPrefixLength)
				// Since printWidth = effectiveWidth + actualPrefixLength,
				// firstLineAvailableWidth = effectiveWidth - annotationPrefixLength
				// For @param, annotationPrefixLength = 7 (@param )
				// So we need effectiveWidth <= 7 to trigger the condition
				const doc: ApexDocAnnotation = {
					type: 'annotation',
					name: 'param',
					content: 'input The input parameter' as Doc,
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
				type: 'annotation',
				name: 'param',
				content:
					'input This is a very long parameter description that should wrap to multiple lines' as Doc,
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
				type: 'annotation',
				name: 'deprecated',
				content: '' as Doc,
			};
			const docs: ApexDocComment[] = [doc];
			const result = wrapAnnotations(docs, 80, 0, 5, {
				tabWidth: 2,
				useTabs: false,
			});
			expect(result).toHaveLength(1);
			expect(result[0]?.type).toBe('annotation');
		});

		it.concurrent('should pass through non-annotation docs', () => {
			const textDoc: ApexDocComment = {
				type: 'text',
				content: 'Some text',
				lines: ['Some text'],
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
				type: 'text',
				content: '   * @param input The input',
				lines: ['   * @param input The input'],
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
			'should collect continuation lines for annotation (lines 125-126)',
			() => {
				// Test lines 125-126: continuation lines in collectContinuationFromDocLines
				const textDoc: ApexDocComment = {
					type: 'text',
					content: '   * @param input The input\n   * continuation line',
					lines: ['   * @param input The input', '   * continuation line'],
				};
				const docs: ApexDocComment[] = [textDoc];
				const result = detectAnnotationsInDocs(docs);
				expect(result.length).toBeGreaterThan(0);
				const annotations = result.filter((d) => d.type === 'annotation');
				expect(annotations.length).toBeGreaterThanOrEqual(1);
				if (annotations[0]?.type === 'annotation') {
					// Should include continuation line in content
					const contentString = String(annotations[0].content);
					expect(contentString).toContain('continuation line');
				}
			},
		);


		it.concurrent('should handle paragraph docs with annotations', () => {
			const paragraphDoc: ApexDocComment = {
				type: 'paragraph',
				content: '   * @param input The input\n   * @return The result',
				lines: ['   * @param input The input', '   * @return The result'],
			};
			const docs: ApexDocComment[] = [paragraphDoc];
			const result = detectAnnotationsInDocs(docs);
			expect(result.length).toBeGreaterThan(0);
			const annotations = result.filter((d) => d.type === 'annotation');
			expect(annotations.length).toBeGreaterThanOrEqual(1);
		});

		it.concurrent(
			'should create text doc from remaining processed lines (lines 260-265)',
			() => {
				// Test lines 260-265: creating text doc from processedLines
				// This happens when some lines have annotations and some don't
				const textDoc: ApexDocComment = {
					type: 'text',
					content: '   * Some text\n   * @param input The input\n   * More text',
					lines: [
						'   * Some text',
						'   * @param input The input',
						'   * More text',
					],
				};
				const docs: ApexDocComment[] = [textDoc];
				const result = detectAnnotationsInDocs(docs);
				// Should have annotation plus remaining text
				const annotations = result.filter((d) => d.type === 'annotation');
				expect(annotations.length).toBeGreaterThanOrEqual(1);
				// Should have remaining text as a text doc
				const textDocs = result.filter((d) => d.type === 'text');
				expect(textDocs.length).toBeGreaterThan(0);
			},
		);

		it.concurrent('should pass through non-text docs', () => {
			const codeDoc: ApexDocComment = {
				type: 'code',
				rawCode: 'System.debug("test");',
				content: 'System.debug("test");',
			};
			const docs: ApexDocComment[] = [codeDoc];
			const result = detectAnnotationsInDocs(docs);
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(codeDoc);
		});
	});

	describe('normalizeAnnotations', () => {
		it.concurrent('should normalize annotation names to lowercase', () => {
			const doc: ApexDocAnnotation = {
				type: 'annotation',
				name: 'PARAM',
				content: 'input The input' as Doc,
			};
			const docs: ApexDocComment[] = [doc];
			const result = normalizeAnnotations(docs);
			expect(result).toHaveLength(1);
			expect(result[0]?.type).toBe('annotation');
			if (result[0]?.type === 'annotation') {
				expect(result[0].name).toBe('param');
			}
		});

		it.concurrent('should pass through non-annotation docs', () => {
			const textDoc: ApexDocComment = {
				type: 'text',
				content: 'Some text',
				lines: ['Some text'],
			};
			const docs: ApexDocComment[] = [textDoc];
			const result = normalizeAnnotations(docs);
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(textDoc);
		});
	});
});