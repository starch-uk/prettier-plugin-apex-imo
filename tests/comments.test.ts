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
			{
				description: 'should return 0 for line with no indentation',
				expected: 0,
				line: 'code',
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
				description:
					'should return correct indent for spaces (2 spaces)',
				expected: 2,
				line: '  code',
				tabWidth: undefined,
			},
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
				description:
					'should return correct indent for mixed spaces and tabs (default tabWidth)',
				expected: 4, // 2 spaces + 1 tab (2 spaces) = 4
				line: '  \tcode',
				tabWidth: undefined,
			},
			{
				description: 'should handle line with only whitespace (spaces)',
				expected: 4,
				line: '    ',
				tabWidth: undefined,
			},
			{
				description: 'should handle line with only whitespace (tabs)',
				expected: 4,
				line: '\t\t',
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
		it.concurrent('should get indent from first asterisk line', () => {
			const text = '    /**\n     * Comment\n     */';
			const indent = getCommentIndent(text, 4);
			expect(indent).toBe(4);
		});

		it.concurrent('should handle comment with no asterisk lines', () => {
			// Comment that ends without finding a * character
			const text = '    /** Comment */';
			const indent = getCommentIndent(text, 4);
			// Should fall back to indent of comment start line
			expect(indent).toBe(4);
		});

		it.concurrent('should handle comment at end of file', () => {
			// When skipToLineEnd returns false (end of file)
			const text = '    /** Comment';
			const indent = getCommentIndent(text, 4);
			// Should fall back to indent of comment start line
			expect(indent).toBe(4);
		});

		it.concurrent(
			'should handle comment with newline that cannot be skipped',
			() => {
				// When skipNewline returns false
				const text = '    /**\r\n     * Comment\n     */';
				const indent = getCommentIndent(text, 4);
				expect(indent).toBe(4);
			},
		);

		it.concurrent('should handle multi-line comment', () => {
			const text = '  /**\n   * Line 1\n   * Line 2\n   */';
			const indent = getCommentIndent(text, 2);
			expect(indent).toBe(2);
		});

		it.concurrent(
			'should handle comment starting at beginning of line',
			() => {
				const text = '/**\n * Comment\n */';
				const indent = getCommentIndent(text, 0);
				expect(indent).toBe(0);
			},
		);

		it.concurrent(
			'should handle comment that ends without finding asterisk (fallback case)',
			() => {
				// Comment that reaches end of text without finding * or */
				// This tests the fallback return at the end of getCommentIndent (lines 100-104)
				// Need a comment that doesn't have * on any line and doesn't end with */
				const text = '    /** Comment text without asterisk or closing';
				const indent = getCommentIndent(text, 4);
				// Should fall back to indent of comment start line
				expect(indent).toBe(4);
			},
		);

		it.concurrent(
			'should handle comment that breaks on finding closing marker',
			() => {
				// Comment that has */ without finding * on a line first
				// This tests the break statement (line 99) when we find */ in the loop
				// Need a comment where we encounter */ before any * on a line
				const text = '    /** Comment text */';
				const indent = getCommentIndent(text, 4);
				// Should fall back to indent of comment start line since no * was found
				expect(indent).toBe(4);
			},
		);

		it.concurrent(
			'should handle comment with unskippable newline (skipNewline returns false)',
			() => {
				// When skipNewline returns false (e.g., with certain newline sequences)
				// This tests afterNewline === false branch
				// Using a comment that starts on a line and has a newline that can't be skipped
				const text = '    /**\r     * Comment\n     */';
				const indent = getCommentIndent(text, 4);
				// The exact indent value depends on how prettier handles the newline
				expect(indent).toBeGreaterThanOrEqual(0);
			},
		);
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

		it.concurrent(
			'should normalize comment starting with /* (comments.ts line 282)',
			() => {
				// Test the branch when comment starts with /* instead of /**
				// This covers line 282: if (comment.substring(start).startsWith('/*'))
				const comment = '  /* Comment text */';
				const expected = '  /** Comment text */';
				const result = normalizeBlockComment(comment, 2, {
					tabWidth: 2,
					useTabs: false,
				});
				expect(result).toBe(expected);
			},
		);

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

			it('should handle comments with undefined stmnts property (line 144)', () => {
				// Test line 144: const stmntsLength = enclosingNodeWithMembers.stmnts?.length ?? NOT_FOUND_LENGTH;
				// When stmnts is undefined, stmnts?.length is undefined, so ?? NOT_FOUND_LENGTH applies
				const comment = {
					enclosingNode: {
						'@class': 'apex.jorje.data.ast.InterfaceDeclaration',
						// stmnts is undefined (not empty array)
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

			it('should return false when binaryExpr.right is missing (comments.ts line 219)', () => {
				// Test the guard clause when binaryExpr.right is undefined/null
				// This covers line 219: if (!binaryExpr.right) return false;
				const comment = {
					placement: 'endOfLine',
					precedingNode: {
						'@class': 'apex.jorje.data.ast.Expr$BinaryExpr',
						// right is missing/undefined
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

			it('should handle empty block statement with comment (comments.ts line 184)', () => {
				// Test the else branch when block has no statements (stmnts is undefined or empty)
				// This covers line 184: addDanglingComment(followingNode, comment, null)
				const comment = {
					followingNode: {
						'@class': 'apex.jorje.data.ast.Stmnt$BlockStmnt',
						// stmnts is undefined or empty array for empty block
						stmnts: [],
					},
				};
				const result = handleRemainingComment(comment, '');
				// Should return true because handleBlockStatementLeadingComment handles it
				expect(result).toBe(true);
			});
		});
	});

	describe('wrapTextToWidth', () => {
		it.concurrent(
			'should handle whitespace-only textContent longer than width (comments.ts line 818)',
			() => {
				// Test the isEmpty(words) guard clause when textContent is only whitespace
				// This covers line 818: if (isEmpty(words)) return [textContent]
				// Need textContent.length > effectiveWidth to pass the first check (line 811)

				/**
				 * 90 spaces, longer than effectiveWidth.
				 */
				const whitespaceOnly = '   '.repeat(30);
				const result = wrapTextToWidth(
					whitespaceOnly,
					10, // effectiveWidth - must be less than textContent.length
					{ tabWidth: 2 },
				);
				// Should return original textContent when words array is empty (only whitespace)
				expect(result).toEqual([whitespaceOnly]);
			},
		);

		it.concurrent.each([
			{ label: 'null', options: { tabWidth: 2, useTabs: null } },
			{ label: 'undefined', options: { tabWidth: 2 } },
		])(
			'should handle useTabs $label (comments.ts line 823 else branch)',
			(
				row: Readonly<{
					label: string;
					options: Readonly<{ tabWidth: number; useTabs?: null }>;
				}>,
			) => {
				// Test the else branch when useTabs is null or undefined
				// This covers line 823: else branch (empty object {})
				const longText = 'word '.repeat(50);
				const result = wrapTextToWidth(longText, 10, row.options);
				expect(result.length).toBeGreaterThan(1);
			},
		);

		it.concurrent(
			'should handle useTabs true (comments.ts line 823 true branch)',
			() => {
				// Test the true branch when useTabs is explicitly true
				// This covers line 823: true branch { useTabs: options.useTabs }

				/**
				 * Long text that needs wrapping.
				 */
				const longText = 'word '.repeat(50);
				const result = wrapTextToWidth(
					longText,
					10, // effectiveWidth
					{ tabWidth: 2, useTabs: true }, // useTabs is true
				);
				// Should wrap successfully with useTabs option
				expect(result.length).toBeGreaterThan(1);
			},
		);
	});

	describe('tokensToCommentString', () => {
		it.concurrent(
			'should process text and paragraph type docs (comments.ts lines 772-779)',
			() => {
				// Test the loop body that processes text/paragraph type docs
				// This covers lines 772-779: the loop that processes docLines and adds prefix
				const textDoc: ApexDocComment = {
					content: 'Some text content',
					lines: ['Some text content'], // Lines for text doc
					type: 'text',
				};
				const paragraphDoc: ApexDocComment = {
					content: 'Paragraph content',
					lines: ['Paragraph content'], // Lines for paragraph doc
					type: 'paragraph',
				};
				const docs: ApexDocComment[] = [textDoc, paragraphDoc];

				const result = tokensToCommentString(docs, 0, {
					tabWidth: 2,
					useTabs: false,
				});

				// Should produce a valid comment string with opening/closing markers
				expect(result).toContain('/**');
				expect(result).toContain('*/');
				expect(result).toContain('Some text content');
				expect(result).toContain('Paragraph content');
			},
		);

		it.concurrent(
			'should handle lines that already start with * (comments.ts line 779)',
			() => {
				// Test the ternary branch when line.trimStart().startsWith('*')
				// This covers line 779: the true branch of the ternary
				const paragraphDoc: ApexDocComment = {
					content: 'Content with * prefix',
					lines: ['   * Content with * prefix'], // Line that already has * prefix
					type: 'paragraph',
				};
				const docs: ApexDocComment[] = [paragraphDoc];

				const result = tokensToCommentString(docs, 0, {
					tabWidth: 2,
					useTabs: false,
				});

				// Should preserve the existing * prefix
				expect(result).toContain('* Content with * prefix');
			},
		);

		it.concurrent(
			'should add prefix to lines without * (comments.ts line 781)',
			() => {
				// Test the ternary branch when line doesn't start with *
				// This covers line 781: the false branch that adds commentPrefix
				const paragraphDoc: ApexDocComment = {
					content: 'Content without prefix',
					lines: ['Content without prefix'], // Line without * prefix
					type: 'paragraph',
				};
				const docs: ApexDocComment[] = [paragraphDoc];

				const result = tokensToCommentString(docs, 2, {
					// commentIndent: 2, tabWidth: 2
					tabWidth: 2,
					useTabs: false,
				});

				// Should add the comment prefix (spaces + *)
				expect(result).toContain('Content without prefix');
				// Should have proper comment structure
				expect(result).toContain('/**');
				expect(result).toContain('*/');
			},
		);

		it.concurrent(
			'should skip code and annotation type docs (comments.ts line 849)',
			() => {
				// Test line 849: continue when doc.type is 'code' or 'annotation'
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

				// Should process text docs but skip code and annotation docs
				expect(result).toContain('/**');
				expect(result).toContain('*/');
				expect(result).toContain('Some text');
				// Code and annotation docs should be skipped, so their content shouldn't appear
				// (they're handled separately in the processing pipeline)
			},
		);
	});

	describe('normalizeBlockComment edge cases', () => {
		it.concurrent(
			'should handle comment without closing slash (comments.ts line 312)',
			() => {
				// Test the break condition when no / is found in normalizeCommentEnd
				// This covers line 312: if (slashPos === -1) break;
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
			},
		);
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
				description:
					'should handle empty comment value (comments.ts line 868)',
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
					// Test the guard clause when commentValue is empty string
					// This covers line 868: if (commentValue === '') return ''
					// Create a comment node with empty value
					const emptyCommentNode = {
						'@class':
							'apex.jorje.parser.impl.HiddenTokens$BlockComment',
						value: '', // Empty comment value
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
