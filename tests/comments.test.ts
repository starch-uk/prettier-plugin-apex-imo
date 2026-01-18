/**
 * @file Unit tests for the comments module.
 */

import { describe, it, expect, vi } from 'vitest';
import type { AstPath, ParserOptions } from 'prettier';
import {
	getIndentLevel,
	createIndent,
	getCommentIndent,
	normalizeBlockComment,
	handleOwnLineComment,
	handleEndOfLineComment,
	handleRemainingComment,
	wrapTextToWidth,
	tokensToCommentString,
	printComment,
	parseCommentToDocs,
	createDocContent,
} from '../src/comments.js';
import type { ApexDocComment } from '../src/comments.js';
import type { ApexNode } from '../src/types.js';
import {
	createMockPath,
	loadFixture,
	extractComment,
	extractCommentIndent,
} from './test-utils.js';

describe('comments', () => {
	describe('getIndentLevel', () => {
		it.concurrent.each([
			// Spaces
			{
				description:
					'should return correct indent for spaces (2 spaces)',
				expected: 2,
				line: '  code',
				tabWidth: undefined,
			},
			{
				description:
					'should return correct indent for spaces (4 spaces)',
				expected: 4,
				line: '    code',
				tabWidth: undefined,
			},
			{
				description: 'should handle line with only whitespace (spaces)',
				expected: 4,
				line: '    ',
				tabWidth: undefined,
			},
			// Tabs
			{
				description:
					'should return correct indent for tabs with default tabWidth (1 tab)',
				expected: 2,
				line: '\tcode',
				tabWidth: undefined,
			},
			{
				description:
					'should return correct indent for tabs with default tabWidth (2 tabs)',
				expected: 4,
				line: '\t\tcode',
				tabWidth: undefined,
			},
			{
				description:
					'should return correct indent for tabs with custom tabWidth (1 tab)',
				expected: 4,
				line: '\tcode',
				tabWidth: 4,
			},
			{
				description:
					'should return correct indent for tabs with custom tabWidth (2 tabs)',
				expected: 8,
				line: '\t\tcode',
				tabWidth: 4,
			},
			{
				description: 'should handle line with only whitespace (tabs)',
				expected: 4,
				line: '\t\t',
				tabWidth: undefined,
			},
			// Mixed spaces and tabs
			{
				description:
					'should return correct indent for mixed spaces and tabs (default tabWidth)',
				expected: 4, // 2 spaces + 1 tab (2 spaces) = 4
				line: '  \tcode',
				tabWidth: undefined,
			},
			// Edge cases
			{
				description: 'should return 0 for line with no indentation',
				expected: 0,
				line: 'code',
				tabWidth: undefined,
			},
			{
				description: 'should handle empty string',
				expected: 0,
				line: '',
				tabWidth: undefined,
			},
			{
				description:
					'should handle line that does not match regex pattern',
				expected: 0,
				line: 'code',
				tabWidth: undefined,
			},
		])(
			'$description',
			({
				expected,
				line,
				tabWidth,
			}: Readonly<{
				description: string;
				expected: number;
				line: string;
				tabWidth: number | undefined;
			}>) => {
				if (tabWidth !== undefined) {
					expect(getIndentLevel(line, tabWidth)).toBe(expected);
				} else {
					expect(getIndentLevel(line)).toBe(expected);
				}
			},
		);
	});

	describe('createIndent', () => {
		it.concurrent.each([
			{ expected: '', level: 0, tabWidth: 2, useTabs: undefined },
			{ expected: '', level: 0, tabWidth: 2, useTabs: true },
			{ expected: '', level: 0, tabWidth: 2, useTabs: false },
			{ expected: '', level: -1, tabWidth: 2, useTabs: undefined },
		])(
			'should return empty string for level $level',
			({
				expected,
				level,
				tabWidth,
				useTabs,
			}: Readonly<{
				expected: string;
				level: number;
				tabWidth: number;
				useTabs: boolean | null | undefined;
			}>) => {
				expect(createIndent(level, tabWidth, useTabs)).toBe(expected);
			},
		);

		it.concurrent.each([
			{ expected: '    ', level: 4, tabWidth: 2, useTabs: false },
			{ expected: '  ', level: 2, tabWidth: 2, useTabs: false },
			{ expected: '    ', level: 4, tabWidth: 2, useTabs: undefined },
			{ expected: '  ', level: 2, tabWidth: 2, useTabs: undefined },
			{ expected: '    ', level: 4, tabWidth: 2, useTabs: null },
		])(
			'should create spaces when useTabs is $useTabs',
			({
				expected,
				level,
				tabWidth,
				useTabs,
			}: Readonly<{
				expected: string;
				level: number;
				tabWidth: number;
				useTabs: boolean | null | undefined;
			}>) => {
				expect(createIndent(level, tabWidth, useTabs)).toBe(expected);
			},
		);

		it.concurrent.each([
			{ expected: '\t\t', level: 4, tabWidth: 2, useTabs: true },
			{ expected: '\t', level: 2, tabWidth: 2, useTabs: true },
			{ expected: '\t\t\t', level: 6, tabWidth: 2, useTabs: true },
			{ expected: '\t', level: 4, tabWidth: 4, useTabs: true },
			{ expected: '\t\t', level: 8, tabWidth: 4, useTabs: true },
			{ expected: '\t', level: 6, tabWidth: 4, useTabs: true }, // Math.floor(6/4) = 1
		])(
			'should create tabs when useTabs is true (level=$level, tabWidth=$tabWidth)',
			({
				level,
				tabWidth,
				useTabs,
				expected,
			}: Readonly<{
				level: number;
				tabWidth: number;
				useTabs: boolean;
				expected: string;
			}>) => {
				expect(createIndent(level, tabWidth, useTabs)).toBe(expected);
			},
		);
	});

	describe('getCommentIndent', () => {
		it.concurrent.each([
			{
				commentIndent: 4,
				description: 'should get indent from first asterisk line',
				expected: 4,
				text: '    /**\n     * Comment\n     */',
			},
			{
				commentIndent: 4,
				description: 'should handle comment with no asterisk lines',
				expected: 4,
				text: '    /** Comment */',
			},
			{
				commentIndent: 4,
				description: 'should handle comment at end of file',
				expected: 4,
				text: '    /** Comment',
			},
			{
				commentIndent: 4,
				description:
					'should handle comment with newline that cannot be skipped',
				expected: 4,
				text: '    /**\r\n     * Comment\n     */',
			},
			{
				commentIndent: 2,
				description: 'should handle multi-line comment',
				expected: 2,
				text: '  /**\n   * Line 1\n   * Line 2\n   */',
			},
			{
				commentIndent: 0,
				description:
					'should handle comment starting at beginning of line',
				expected: 0,
				text: '/**\n * Comment\n */',
			},
			{
				commentIndent: 4,
				description:
					'should handle comment that ends without finding asterisk (fallback case)',
				expected: 4,
				text: '    /** Comment text without asterisk or closing',
			},
			{
				commentIndent: 4,
				description:
					'should handle comment that breaks on finding closing marker',
				expected: 4,
				text: '    /** Comment text */',
			},
		])(
			'$description',
			({
				commentIndent,
				expected,
				text,
			}: Readonly<{
				commentIndent: number;
				description: string;
				expected: number;
				text: string;
			}>) => {
				const indent = getCommentIndent(text, commentIndent);
				expect(indent).toBe(expected);
			},
		);

		it.concurrent('should handle comment with unskippable newline', () => {
			const text = '    /**\r     * Comment\n     */';
			const indent = getCommentIndent(text, 4);
			expect(indent).toBeGreaterThanOrEqual(0);
		});
	});

	describe('normalizeBlockComment', () => {
		it.concurrent.each([
			{
				description: 'should normalize extra asterisks in start marker',
				fixture: 'block-comment-extra-asterisks-start',
			},
			{
				description: 'should normalize extra asterisks in end marker',
				fixture: 'block-comment-extra-asterisks-end',
			},
			{
				description: 'should add asterisks to lines without them',
				fixture: 'block-comment-missing-asterisks',
			},
			{
				description:
					'should normalize multiple asterisks to single asterisk',
				fixture: 'block-comment-multiple-asterisks',
			},
			{
				description: 'should normalize inconsistent indentation',
				fixture: 'block-comment-inconsistent-indent',
			},
			{
				description: 'should handle mixed malformations',
				fixture: 'block-comment-mixed-malformations',
			},
		])(
			'$description',
			({
				fixture,
			}: Readonly<{
				description: string;
				fixture: string;
			}>) => {
				const inputText = loadFixture(fixture, 'input');
				const expectedText = loadFixture(fixture, 'output');
				const inputComment = extractComment(inputText);
				const expectedComment = extractComment(expectedText);
				const commentIndent = extractCommentIndent(inputText);
				const options = { tabWidth: 2, useTabs: false };

				const result = normalizeBlockComment(
					inputComment,
					commentIndent,
					options,
				);
				expect(result).toBe(expectedComment);
			},
		);

		it.concurrent.each([
			{
				description:
					'should normalize asterisks on lines containing {@code',
				fixture: 'block-comment-code-missing-asterisks',
			},
			{
				description:
					'should normalize multiple asterisks before {@code',
				fixture: 'block-comment-code-multiple-asterisks',
			},
			{
				description:
					'should normalize indentation for code block lines',
				fixture: 'block-comment-code-inconsistent-indent',
			},
			{
				description: 'should handle mixed code block malformations',
				fixture: 'block-comment-code-mixed-malformations',
			},
		])(
			'$description',
			({
				fixture,
			}: Readonly<{
				description: string;
				fixture: string;
			}>) => {
				const inputText = loadFixture(fixture, 'input');
				const expectedText = loadFixture(fixture, 'output');
				const inputComment = extractComment(inputText);
				const expectedComment = extractComment(expectedText);
				const commentIndent = extractCommentIndent(inputText);
				const options = { tabWidth: 2, useTabs: false };

				const result = normalizeBlockComment(
					inputComment,
					commentIndent,
					options,
				);
				expect(result).toBe(expectedComment);
			},
		);

		it.concurrent('should normalize comment starting with /*', () => {
			const comment = '  /* Comment text */';
			const expected = '  /** Comment text */';
			const result = normalizeBlockComment(comment, 2, {
				tabWidth: 2,
				useTabs: false,
			});
			expect(result).toBe(expected);
		});

		it.concurrent('should handle comment with leading whitespace', () => {
			// Comment with leading whitespace before /*
			const comment = '  /* comment */';
			const result = normalizeBlockComment(comment, 0, {
				tabWidth: 2,
				useTabs: false,
			});
			expect(result).toContain('/*');
		});
	});

	describe('comment attachment handlers', () => {
		describe('handleOwnLineComment', () => {
			it('should return false for invalid input', () => {
				const result = handleOwnLineComment(null, '');
				expect(result).toBe(false);
			});

			it('should handle comments that can be attached to own line', () => {
				// Test with a comment that has an enclosing node that allows dangling comments
				const comment = {
					enclosingNode: {
						'@class': 'apex.jorje.data.ast.ClassDeclaration',
						stmnts: [],
					},
				};
				const result = handleOwnLineComment(comment, '');
				expect(result).toBe(true);
			});

			it('should handle comments with undefined stmnts property', () => {
				const comment = {
					enclosingNode: {
						'@class': 'apex.jorje.data.ast.InterfaceDeclaration',
						members: [],
					},
				};
				const result = handleOwnLineComment(comment, '');
				expect(result).toBe(true);
			});
		});

		describe('handleEndOfLineComment', () => {
			it('should return false for invalid input', () => {
				const result = handleEndOfLineComment(null, '');
				expect(result).toBe(false);
			});

			it('should handle end-of-line comments', () => {
				// Test with a binary expression comment
				const comment = {
					placement: 'endOfLine',
					precedingNode: {
						'@class': 'apex.jorje.data.ast.Expr$BinaryExpr',
						right: { type: 'expression' },
					},
				};
				const result = handleEndOfLineComment(comment, '');
				expect(result).toBe(true);
			});

			it('should return false when binaryExpr.right is missing', () => {
				const comment = {
					placement: 'endOfLine',
					precedingNode: {
						'@class': 'apex.jorje.data.ast.Expr$BinaryExpr',
					},
				};
				const result = handleEndOfLineComment(comment, '');
				expect(result).toBe(false);
			});
		});

		describe('handleRemainingComment', () => {
			it('should return false for invalid input', () => {
				const result = handleRemainingComment(null, '');
				expect(result).toBe(false);
			});

			it('should handle remaining comments', () => {
				// Test with a block statement comment
				const comment = {
					followingNode: {
						'@class': 'apex.jorje.data.ast.Stmnt$BlockStmnt',
						stmnts: [{ type: 'statement' }],
					},
				};
				const result = handleRemainingComment(comment, '');
				expect(result).toBe(true);
			});

			it('should handle empty block statement with comment', () => {
				const comment = {
					followingNode: {
						'@class': 'apex.jorje.data.ast.Stmnt$BlockStmnt',
						stmnts: [],
					},
				};
				const result = handleRemainingComment(comment, '');
				expect(result).toBe(true);
			});
		});
	});

	describe('wrapTextToWidth', () => {
		it.concurrent(
			'should handle whitespace-only textContent longer than width',
			() => {
				const whitespaceOnly = '   '.repeat(30);
				const result = wrapTextToWidth(whitespaceOnly, 10, {
					tabWidth: 2,
				});
				expect(result).toEqual([whitespaceOnly]);
			},
		);

		it.concurrent.each([
			{ label: 'null', options: { tabWidth: 2, useTabs: null } },
			{ label: 'undefined', options: { tabWidth: 2 } },
			{ label: 'true', options: { tabWidth: 2, useTabs: true } },
		])(
			'should handle useTabs $label',
			(
				row: Readonly<{
					label: string;
					options: Readonly<{
						tabWidth: number;
						useTabs?: boolean | null;
					}>;
				}>,
			) => {
				const longText = 'word '.repeat(50);
				const result = wrapTextToWidth(longText, 10, row.options);
				expect(result.length).toBeGreaterThan(1);
			},
		);
	});

	describe('tokensToCommentString', () => {
		it.concurrent('should process text and paragraph type docs', () => {
			const textDoc: ApexDocComment = {
				content: 'Some text content',
				lines: ['Some text content'],
				type: 'text',
			};
			const paragraphDoc: ApexDocComment = {
				content: 'Paragraph content',
				lines: ['Paragraph content'],
				type: 'paragraph',
			};
			const docs: ApexDocComment[] = [textDoc, paragraphDoc];

			const result = tokensToCommentString(docs, 0, {
				tabWidth: 2,
				useTabs: false,
			});

			expect(result).toContain('/**');
			expect(result).toContain('*/');
			expect(result).toContain('Some text content');
			expect(result).toContain('Paragraph content');
		});

		it.concurrent('should handle lines that already start with *', () => {
			const paragraphDoc: ApexDocComment = {
				content: 'Content with * prefix',
				lines: ['   * Content with * prefix'],
				type: 'paragraph',
			};
			const docs: ApexDocComment[] = [paragraphDoc];

			const result = tokensToCommentString(docs, 0, {
				tabWidth: 2,
				useTabs: false,
			});

			expect(result).toContain('* Content with * prefix');
		});

		it.concurrent('should add prefix to lines without *', () => {
			const paragraphDoc: ApexDocComment = {
				content: 'Content without prefix',
				lines: ['Content without prefix'],
				type: 'paragraph',
			};
			const docs: ApexDocComment[] = [paragraphDoc];

			const result = tokensToCommentString(docs, 2, {
				tabWidth: 2,
				useTabs: false,
			});

			expect(result).toContain('Content without prefix');
			expect(result).toContain('/**');
			expect(result).toContain('*/');
		});

		it.concurrent('should skip code and annotation type docs', () => {
			const textDoc: ApexDocComment = {
				content: 'Some text',
				lines: ['Some text'],
				type: 'text',
			};
			const codeDoc: ApexDocComment = {
				content: 'System.debug("test");',
				rawCode: 'System.debug("test");',
				type: 'code',
			};
			const annotationDoc: ApexDocComment = {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-type-assertion -- Doc type assertion for test
				content: 'param input The input' as unknown as Doc,
				name: 'param',
				type: 'annotation',
			};
			const docs: ApexDocComment[] = [
				textDoc,
				codeDoc,
				annotationDoc,
				textDoc,
			];

			const result = tokensToCommentString(docs, 0, {
				tabWidth: 2,
				useTabs: false,
			});

			expect(result).toContain('/**');
			expect(result).toContain('*/');
			expect(result).toContain('Some text');
		});
	});

	describe('normalizeBlockComment edge cases', () => {
		it.concurrent('should handle comment without closing slash', () => {
			// Test the break condition when no / is found in normalizeCommentEnd
			// This covers the case when no slash is found in the comment
			// A comment without / would be malformed, but we should handle it gracefully
			const malformedComment = '/** Comment text without closing';
			// normalizeBlockComment should handle this - the normalizeCommentEnd will break
			// when no / is found after searching through the string
			const result = normalizeBlockComment(malformedComment, 0, {
				tabWidth: 2,
				useTabs: false,
			});
			// Should return normalized comment (start normalization happens first)
			expect(typeof result).toBe('string');
			expect(result).toContain('/**');
		});
	});

	describe('printComment', () => {
		it.concurrent.each([
			{
				description: 'should return empty string when node is null',
				setupMockPath: (): AstPath<ApexNode> => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path for test
					return {
						getNode: (): null => null,
					} as unknown as AstPath<ApexNode>;
				},
			},
			{
				description:
					'should return empty string when node does not have value property',
				setupMockPath: (): AstPath<ApexNode> => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock node for test
					const mockNode = {} as unknown as ApexNode;
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path for test
					return {
						getNode: (): ApexNode => mockNode,
					} as unknown as AstPath<ApexNode>;
				},
			},
			{
				description:
					'should return empty string when node value is not a string',
				setupMockPath: (): AstPath<ApexNode> => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock node for test
					const mockNode = {
						value: 123,
					} as unknown as ApexNode;
					// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock path for test
					return {
						getNode: (): ApexNode => mockNode,
					} as unknown as AstPath<ApexNode>;
				},
			},
			{
				description: 'should handle empty comment value',
				formatCallbacks: {
					getCommentId: (_key: string): undefined => undefined,
					skipToLineEnd: (): string => '',
					skipWhitespace: (): string => '',
				},
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
				options: {
					printWidth: 80,
					tabWidth: 2,
				} as ParserOptions,
				setupMockPath: (): AstPath<ApexNode> => {
					const emptyCommentNode = {
						'@class':
							'apex.jorje.parser.impl.HiddenTokens$BlockComment',
						value: '',
					};
					return {
						// eslint-disable-next-line @typescript-eslint/no-misused-spread -- Spread needed for mock path customization
						...createMockPath(emptyCommentNode),
						getNode: (): ApexNode => emptyCommentNode,
					};
				},
			},
		])(
			'$description',
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
			({
				formatCallbacks,
				options,
				setupMockPath,
			}: Readonly<{
				description: string;
				formatCallbacks?: Readonly<{
					getCommentId: (key: Readonly<string>) => undefined;
					skipToLineEnd: () => string;
					skipWhitespace: () => string;
				}>;
				options?: Readonly<ParserOptions>;
				setupMockPath: Readonly<() => AstPath<ApexNode>>;
			}>) => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock path for test
				const mockPath = setupMockPath();
				const defaultOptions: ParserOptions = {
					tabWidth: 2,
					useTabs: false,
				};
				const testOptions: Readonly<ParserOptions> =
					options ?? defaultOptions;

				const result = printComment(
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Mock path for test
					mockPath,
					testOptions,
					formatCallbacks?.skipToLineEnd ?? vi.fn(),
					formatCallbacks?.skipWhitespace ?? vi.fn(),
					testOptions,
					formatCallbacks?.getCommentId ?? vi.fn(() => undefined),
					vi.fn(() => undefined),
				);

				expect(result).toBe('');
			},
		);
	});

	describe('parseCommentToDocs', () => {
		it.concurrent('should create text doc when no paragraphs found', () => {
			// Empty comment with just whitespace - no paragraphs created
			const emptyComment = '/**\n *\n *\n */';
			const result = parseCommentToDocs(emptyComment);
			expect(result).toHaveLength(1);
			expect(result[0]?.type).toBe('text');
		});

		it.concurrent(
			'should handle removeCommentPrefix fallback when regex does not match',
			() => {
				// Use removeCommentPrefix directly via parseCommentToDocs with malformed input
				// Line without asterisk pattern when preserveIndent=true
				const comment = '/**\n * normal line\n *   \n */';
				const result = parseCommentToDocs(comment);
				expect(result.length).toBeGreaterThan(0);
			},
		);
	});

	describe('createDocContent', () => {
		it.concurrent('should handle empty lines array', () => {
			// Test createDocContent with empty lines array
			// This path is defensive and unlikely in practice but tested for completeness
			const result = createDocContent('text', '', []);
			expect(result.type).toBe('text');
			expect(result.content).toBe('');
		});
	});
});
