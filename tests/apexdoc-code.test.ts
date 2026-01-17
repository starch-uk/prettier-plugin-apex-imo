/**
 * @file Unit tests for the apexdoc-code module.
 */

import { describe, it, expect } from 'vitest';
import {
	CODE_TAG,
	CODE_TAG_LENGTH,
	EMPTY_CODE_TAG,
	extractCodeFromBlock,
	processCodeBlockLines,
	createDocCodeBlock,
	processCodeBlock,
	renderCodeBlockInComment,
	processAllCodeBlocksInComment,
	countBracesAndCheckEnd,
} from '../src/apexdoc-code.js';
import type { ParserOptions } from 'prettier';
import plugin from '../src/index.js';

describe('apexdoc-code', () => {
	describe('CODE_TAG', () => {
		it.concurrent('should be {@code', () => {
			expect(CODE_TAG).toBe('{@code');
		});
	});

	describe('CODE_TAG_LENGTH', () => {
		it.concurrent('should match CODE_TAG length', () => {
			expect(CODE_TAG_LENGTH).toBe(CODE_TAG.length);
		});
	});

	describe('EMPTY_CODE_TAG', () => {
		it.concurrent('should be {@code}', () => {
			expect(EMPTY_CODE_TAG).toBe('{@code}');
		});
	});

	describe('extractCodeFromBlock', () => {
		it.concurrent('should extract simple code block', () => {
			const text = '{@code Integer x = 10; }';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			// Code extraction may include trailing space before closing brace
			expect(result?.code.trim()).toBe('Integer x = 10;');
		});

		it.concurrent('should extract multiline code block', () => {
			const text = '{@code\nInteger x = 10;\nString y = "test";\n}';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trimStart()).toContain('Integer x = 10;');
			expect(result?.code.trimEnd()).toContain('String y = "test";');
		});

		it.concurrent('should extract code block with nested braces', () => {
			const text = '{@code\nif (true) {\n  return;\n}\n}';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trim()).toContain('if (true) {');
		});

		it.concurrent('should return null when braces are unmatched and no closing brace found (line 63)', () => {
			// Create scenario where braceCount > 0 (unmatched braces) AND lastClosingBracePos === NOT_FOUND_INDEX
			// This requires text with opening braces but no closing braces at all
			const text = '{@code if (true) { if (false) {';
			const result = extractCodeFromBlock(text, 0);
			// Should return null when lastClosingBracePos is NOT_FOUND_INDEX and braceCount !== 0
			expect(result).toBeNull();
		});

		it.concurrent('should handle code block with asterisks (comment-style)', () => {
			const text = '{@code\n * Integer x = 10;\n * }';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trim()).toContain('Integer x = 10;');
		});

		it.concurrent('should trim leading and trailing blank lines', () => {
			const text = '{@code\n\nInteger x = 10;\n\n}';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trim()).toBe('Integer x = 10;');
		});

		it.concurrent('should preserve middle blank lines', () => {
			const text = '{@code\nInteger x = 10;\n\nString y = "test";\n}';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trimStart()).toContain('Integer x = 10;');
			expect(result?.code).toContain('\n\n');
			expect(result?.code.trimEnd()).toContain('String y = "test";');
		});

		it.concurrent('should handle code block starting at non-zero position', () => {
			const text = 'prefix {@code Integer x = 10; } suffix';
			const codeTagPos = text.indexOf('{@code');
			const result = extractCodeFromBlock(text, codeTagPos);
			expect(result).not.toBeNull();
			expect(result?.code.trim()).toBe('Integer x = 10;');
		});

		it.concurrent('should handle empty code block', () => {
			const text = '{@code }';
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code).toBe('');
		});

		it.concurrent('should handle unmatched braces with lastClosingBracePos', () => {
			const text = '{@code Integer x = 10; } extra';
			// Create scenario where braceCount doesn't reach 0 but lastClosingBracePos exists
			// This tests the fallback path
			const result = extractCodeFromBlock(text, 0);
			expect(result).not.toBeNull();
			expect(result?.code.trim()).toBe('Integer x = 10;');
		});
	});

	describe('processCodeBlockLines', () => {
		it.concurrent('should process lines with code block', () => {
			const lines = [' * {@code', ' *   Integer x = 10;', ' * }'];
			const result = processCodeBlockLines(lines);
			expect(result).toHaveLength(3);
			expect(result[0]).toContain('{@code');
			expect(result[1]).toContain('Integer x = 10;');
		});

		it.concurrent('should handle lines without code block', () => {
			const lines = [' * Regular comment line', ' * Another line'];
			const result = processCodeBlockLines(lines);
			expect(result).toHaveLength(2);
		});

		it.concurrent('should handle nested braces in code block', () => {
			const lines = [
				' * {@code',
				' *   if (true) {',
				' *     return;',
				' *   }',
				' * }',
			];
			const result = processCodeBlockLines(lines);
			expect(result).toHaveLength(5);
		});

		it.concurrent('should handle standalone closing brace (line 146)', () => {
			// Test the standalone '}' case that triggers line 146
			// For first line (index 0), prefix is empty string (index > EMPTY ? ' ' : '')
			const lines = [' *   }'];
			const result = processCodeBlockLines(lines);
			expect(result[0]).toContain('}');
			// Should return prefix + commentLine.trimStart()
			// index 0: prefix = '', commentLine = ' *   }', trimStart() = '*   }', so result = '*   }'
			expect(result[0]).toBe('*   }');
			
			// Test with second line to get prefix = ' '
			const lines2 = [' * Line 1', ' *   }'];
			const result2 = processCodeBlockLines(lines2);
			// index 1: prefix = ' ', commentLine = ' *   }', trimStart() = '*   }', so result = ' *   }'
			expect(result2[1]).toBe(' *   }');
		});

		it.concurrent(
			'should handle code block ending within a line (apexdoc-code.ts lines 152-157, 161-165)',
			() => {
				// Test when inCodeBlock is true, line doesn't start with CODE_TAG, and willEndCodeBlock is true
				// This exercises: countBracesAndCheckEnd call (line 152), assignments (156-157),
				// and the willEndCodeBlock=true branch (162-163) that sets inCodeBlock=false
				const lines = [
					' * {@code', // Starts code block, sets inCodeBlock=true, codeBlockBraceCount=1
					' *   Integer x = 10;', // In code block, processes braces (line 151-157)
					' * }', // Decrements braceCount to 0, willEndCodeBlock=true (line 152-157)
					// Then enters if (inCodeBlock && !trimmedLine.startsWith(CODE_TAG)) (line 160)
					// And sets inCodeBlock=false when willEndCodeBlock=true (line 162-163)
				];
				const result = processCodeBlockLines(lines);
				expect(result.length).toBe(3);
				// Verify the closing brace was processed correctly
				expect(result[2]).toContain('}');
				// Verify subsequent processing after code block ends
				const linesAfter = [' * {@code', ' *   Integer x = 10;', ' * }', ' * More text'];
				const resultAfter = processCodeBlockLines(linesAfter);
				// After ' * }', inCodeBlock should be false, so ' * More text' should be processed normally
				expect(resultAfter[3]).toContain('More text');
			},
		);

		it.concurrent('should handle standalone closing brace not in code block (line 146)', () => {
			// Test the standalone '}' case that triggers line 146
			// This is when trimmedLine === '}' but NOT in a code block (inCodeBlock = false)
			const lines = [' *   }'];
			const result = processCodeBlockLines(lines);
			// trimmedLine = '}', inCodeBlock = false, so skips line 137 condition
			// Goes to line 145: if (trimmedLine === '}') return prefix + commentLine.trimStart()
			expect(result[0]).toBe('*   }'); // prefix '' + ' *   }'.trimStart() = '*   }'
		});

		it.concurrent('should handle empty lines array', () => {
			const lines: readonly string[] = [];
			const result = processCodeBlockLines(lines);
			expect(result).toHaveLength(0);
		});

		it.concurrent('should handle single line code block', () => {
			const lines = [' * {@code Integer x = 10; }'];
			const result = processCodeBlockLines(lines);
			expect(result[0]).toContain('{@code');
		});
	});


	describe('createDocCodeBlock', () => {
		it.concurrent('should create code block doc from simple code', () => {
			const code = 'Integer x = 10;';
			const result = createDocCodeBlock(0, code.length, code);
			expect(result).toBeDefined();
			expect(result.type).toBe('code');
			expect(result.rawCode).toBe(code);
		});

		it.concurrent('should create code block doc from multiline code', () => {
			const code = 'Integer x = 10;\nString y = "test";';
			const result = createDocCodeBlock(0, code.length, code);
			expect(result).toBeDefined();
			expect(result.type).toBe('code');
			expect(result.rawCode).toBe(code);
		});

		it.concurrent('should handle empty code', () => {
			const code = '';
			const result = createDocCodeBlock(0, 0, code);
			expect(result).toBeDefined();
			expect(result.type).toBe('code');
			expect(result.rawCode).toBe(code);
		});

		it.concurrent('should use formattedCode when provided', () => {
			const rawCode = 'integer x = 10;';
			const formattedCode = 'Integer x = 10;';
			const result = createDocCodeBlock(0, rawCode.length, rawCode, formattedCode);
			expect(result).toBeDefined();
			expect(result.rawCode).toBe(rawCode);
			expect(result.formattedCode).toBe(formattedCode);
		});

		it.concurrent('should create single-line content doc for single line code', () => {
			const code = 'Integer x = 10;';
			const result = createDocCodeBlock(0, code.length, code);
			expect(result.content).toBe(code);
		});

		it.concurrent('should create multi-line content doc for multi-line code', () => {
			const code = 'Integer x = 10;\nString y = "test";';
			const result = createDocCodeBlock(0, code.length, code);
			expect(result.content).toBeDefined();
			// Content should be a Doc array for multi-line
			expect(Array.isArray(result.content) || typeof result.content === 'string').toBe(true);
		});
	});

	describe('processCodeBlock', () => {
		it.concurrent('should return original block when not starting with {@code', () => {
			const codeBlock = 'Not a code block';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			expect(result).toEqual([codeBlock]);
		});

		it.concurrent('should return original block when extraction fails', () => {
			const codeBlock = '{@code unmatched braces';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			// When extraction fails, should return original block
			expect(result).toEqual([codeBlock]);
		});

		it.concurrent('should return original block for empty code content', () => {
			const codeBlock = '{@code }';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			expect(result).toEqual([codeBlock]);
		});

		it.concurrent('should process single-line code block', () => {
			const codeBlock = '{@code Integer x = 10; }';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			expect(result).toHaveLength(1);
			expect(result[0]).toContain('{@code');
			expect(result[0]).toContain('Integer x = 10;');
		});

		it.concurrent('should process single-line code block ending with semicolon', () => {
			const codeBlock = '{@code Integer x = 10; }';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			expect(result[0]).toContain('Integer x = 10;');
		});

		it.concurrent('should process multiline code block', () => {
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			const getFormattedCodeBlock = () => undefined;
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe('{@code');
			expect(result[result.length - 1]).toBe('}');
		});

		it.concurrent('should not use formatted code block when commentKey is null', () => {
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			const getFormattedCodeBlock = () => 'should not be used';
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, null, options);
			// Should use raw code lines, not formatted block
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe('{@code');
			expect(result[result.length - 1]).toBe('}');
		});

		it.concurrent('should use extractCodeFromEmbedResult when embedResult exists (lines 301-302)', () => {
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			// Mock formatted embed result with comment structure ending with \n */\n (line 225)
			const embedResult = '/**\n * {@code\n *   Integer x = 10;\n *   String y = "test";\n * }\n */\n';
			const getFormattedCodeBlock = (key: string) => {
				if (key === 'test-key') return embedResult;
				return undefined;
			};
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, 'test-key', options);
			// Should use extractCodeFromEmbedResult to extract lines from embedResult
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe('{@code');
			expect(result[result.length - 1]).toBe('}');
			// Should contain extracted code lines
			expect(result.some(line => line.includes('Integer x = 10;'))).toBe(true);
		});

		it.concurrent('should handle embedResult ending with \n */ (line 226-227)', () => {
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			// Mock formatted embed result ending with \n */ (without trailing newline) - line 226-227
			const embedResult = '/**\n * {@code\n *   Integer x = 10;\n *   String y = "test";\n * }\n */';
			const getFormattedCodeBlock = (key: string) => {
				if (key === 'test-key') return embedResult;
				return undefined;
			};
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, 'test-key', options);
			// Should handle both ending formats
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe('{@code');
			expect(result[result.length - 1]).toBe('}');
		});

		it.concurrent('should handle lines without asterisk in extractCodeFromEmbedResult (line 246)', () => {
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			// Mock formatted embed result with lines that don't start with asterisk after whitespace
			// This triggers line 246: return line; (when line doesn't have asterisk)
			const embedResult = '/**\n * {@code\n *   Line with asterisk\nPlain line without asterisk\n * }\n */\n';
			const getFormattedCodeBlock = (key: string) => {
				if (key === 'test-key') return embedResult;
				return undefined;
			};
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, 'test-key', options);
			// Should handle lines without asterisk
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe('{@code');
			expect(result[result.length - 1]).toBe('}');
		});

		it.concurrent('should handle embedResult without code markers (line 246, 263)', () => {
			// Use multiline codeBlock to avoid early return for single-line code
			const codeBlock = '{@code\nInteger x = 10;\nString y = "test";\n}';
			// Mock formatted embed result without {@code markers - should use slice fallback
			// Also include lines without asterisk prefix (line 246 return line path)
			// Format: /**\n * line1\n * line2\n * line3\n */\n (ends with \n */\n to test line 225)
			// After removing first 2 lines (SKIP_FIRST_TWO_LINES), should have at least line3
			const embedResult = '/**\n * Line 1\n * Line 2\n * Line 3\n */\n';
			const getFormattedCodeBlock = (key: string) => {
				if (key === 'test-key') return embedResult;
				return undefined;
			};
			const options = {} as ParserOptions;
			const result = processCodeBlock(codeBlock, options, getFormattedCodeBlock, 'test-key', options);
			// Should fall back to slice(SKIP_FIRST_TWO_LINES) when code markers not found
			// This wraps result in {@code ... }, so length should be at least 3: ['{@code', 'Line 3', '}']
			expect(result.length).toBeGreaterThanOrEqual(3);
			expect(result[0]).toBe('{@code');
			expect(result[result.length - 1]).toBe('}');
			// Should contain the extracted line from slice fallback
			expect(result.some(line => line.includes('Line 3'))).toBe(true);
		});
	});

	describe('renderCodeBlockInComment', () => {
		it.concurrent('should render empty code block', () => {
			const doc = createDocCodeBlock(0, 0, '');
			const commentPrefix = '   * ';
			const result = renderCodeBlockInComment(doc, commentPrefix);
			expect(result).toEqual([`${commentPrefix}{@code}`]);
		});

		it.concurrent('should render single-line code block', () => {
			const code = 'Integer x = 10;';
			const doc = createDocCodeBlock(0, code.length, code);
			const commentPrefix = '   * ';
			const result = renderCodeBlockInComment(doc, commentPrefix);
			expect(result).toHaveLength(1);
			expect(result[0]).toContain('Integer x = 10;');
		});

		it.concurrent('should render multiline code block', () => {
			const code = 'Integer x = 10;\nString y = "test";';
			const doc = createDocCodeBlock(0, code.length, code);
			const commentPrefix = '   * ';
			const result = renderCodeBlockInComment(doc, commentPrefix);
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toContain('Integer x = 10;');
			expect(result[1]).toContain('String y = "test";');
		});

		it.concurrent('should use formattedCode when available', () => {
			const rawCode = 'integer x = 10;';
			const formattedCode = 'Integer x = 10;';
			const doc = createDocCodeBlock(0, rawCode.length, rawCode, formattedCode);
			const commentPrefix = '   * ';
			const result = renderCodeBlockInComment(doc, commentPrefix);
			expect(result[0]).toContain('Integer x = 10;'); // Should use formattedCode
			expect(result[0]).not.toContain('integer x = 10;'); // Should not use rawCode
		});

		it.concurrent('should handle empty lines in code block', () => {
			const code = 'Integer x = 10;\n\nString y = "test";';
			const doc = createDocCodeBlock(0, code.length, code);
			const commentPrefix = '   * ';
			const result = renderCodeBlockInComment(doc, commentPrefix);
			expect(result.length).toBeGreaterThan(2);
			// Empty line should use trimmedCommentPrefix which is commentPrefix.trimEnd() = "   *"
			expect(result[1]).toBe('   *');
		});
	});

	describe('processAllCodeBlocksInComment', () => {
		it.concurrent('should return undefined when comment has no code blocks', async () => {
			const commentText = '/**\n * This is a regular comment\n * with no code blocks\n */';
			const options = {
				printWidth: 80,
				tabWidth: 2,
			} as ParserOptions;
			const formattedCodeBlocks = new Map<string, string>();
			const setFormattedCodeBlock = (key: string, value: string): void => {
				formattedCodeBlocks.set(key, value);
			};

			const result = await processAllCodeBlocksInComment({
				commentText,
				options,
				plugins: [plugin],
				commentPrefixLength: 5,
				setFormattedCodeBlock,
			});

			expect(result).toBeUndefined();
		});

		it.concurrent('should process code block with blank line preservation (line 448)', async () => {
			// Code block that will trigger preserveBlankLineAfterClosingBrace
			// Need code that formats to have } followed by @annotation or access modifier
			const commentText =
				'/**\n * {@code\n *   public void method() {\n *     return;\n *   }\n *   @Future\n *   public void next() {}\n * }\n */';
			const options = {
				printWidth: 80,
				tabWidth: 2,
			} as ParserOptions;
			const formattedCodeBlocks = new Map<string, string>();
			const setFormattedCodeBlock = (key: string, value: string): void => {
				formattedCodeBlocks.set(key, value);
			};

			const result = await processAllCodeBlocksInComment({
				commentText,
				options,
				plugins: [plugin],
				commentPrefixLength: 5,
				setFormattedCodeBlock,
			});

			expect(result).toBeDefined();
			expect(result).toContain('{@code');
			// Should have preserved blank line after closing brace when followed by @Future or public
		});

		it.concurrent('should handle malformed code block (extraction fails)', async () => {
			// Code block with unmatched braces to trigger the continue path
			const commentText = '/**\n * {@code unmatched braces\n */';
			const options = {
				printWidth: 80,
				tabWidth: 2,
			} as ParserOptions;
			const formattedCodeBlocks = new Map<string, string>();
			const setFormattedCodeBlock = (key: string, value: string): void => {
				formattedCodeBlocks.set(key, value);
			};

			// Should return undefined because extraction fails and no changes are made
			const result = await processAllCodeBlocksInComment({
				commentText,
				options,
				plugins: [plugin],
				commentPrefixLength: 5,
				setFormattedCodeBlock,
			});

			// When extraction fails, startIndex advances and loop continues, but if no valid blocks are found, returns undefined
			expect(result).toBeUndefined();
		});
	});

	describe('countBracesAndCheckEnd', () => {
		it.concurrent(
			'should count braces and detect code block end (apexdoc-code.ts lines 130-135)',
			() => {
				// Start with braceCount = 1 (from {@code opening)
				const result = countBracesAndCheckEnd('Integer x = 1; }', 1);
				expect(result.braceCount).toBe(0);
				expect(result.willEnd).toBe(true);
			},
		);

		it.concurrent('should handle nested braces', () => {
			const result = countBracesAndCheckEnd('if (true) { x = 1; }', 1);
			expect(result.braceCount).toBe(1); // +1 from {, -1 from }
			expect(result.willEnd).toBe(false);
		});

		it.concurrent(
			'should handle code block ending on line with content (apexdoc-code.ts lines 139-143)',
			() => {
				// Code block ending on line with content
				const result = countBracesAndCheckEnd('  }', 1);
				expect(result.braceCount).toBe(0);
				expect(result.willEnd).toBe(true);
			},
		);
	});

	describe('processCodeBlockLines', () => {
		it.concurrent(
			'should handle code block ending on line with content (apexdoc-code.ts lines 148-153, 157-161)',
			() => {
				// Lines where code block ends with willEndCodeBlock = true
				// First line starts code block (sets inCodeBlock = true, codeBlockBraceCount = 1)
				// Second line has content + closing brace that ends the block
				const lines = [
					' * {@code',
					' *   Integer x = 1; }', // This line decrements braceCount to 0 (willEndCodeBlock = true)
				];
				const result = processCodeBlockLines(lines);
				expect(result).toHaveLength(2);
				expect(result[0]).toContain('{@code');
				// Second line should be processed: inCodeBlock=true, !startsWith(CODE_TAG), willEndCodeBlock=true
				// This should execute lines 148-153 (countBracesAndCheckEnd) and 157-161 (willEndCodeBlock check)
				expect(result[1]).toContain('Integer x = 1;');
				expect(result[1]).toContain('}');
			},
		);

		it.concurrent(
			'should handle code block content line with willEnd=false (apexdoc-code.ts lines 183-192)',
			() => {
				// Test when inCodeBlock=true, !startsWith(CODE_TAG), willEnd=false
				// This covers the ternary's false branch: willEnd ? {...} : nextState
				// Lines should be: {@code, content line (willEnd=false), closing }
				const lines = [
					' * {@code', // Starts code block, sets inCodeBlock=true, codeBlockBraceCount=1
					' *   Integer x = 10;', // In code block, processes braces, willEnd=false (braceCount still 1)
					' * }', // This line will set willEnd=true
				];
				const result = processCodeBlockLines(lines);
				expect(result).toHaveLength(3);
				expect(result[0]).toContain('{@code');
				// Second line: isCodeContent=true, willEnd=false, should use nextState (not the ternary's true branch)
				// This exercises lines 183-192, specifically the false branch of the ternary
				expect(result[1]).toContain('Integer x = 10;');
				expect(result[1]).not.toContain('}');
				expect(result[2]).toContain('}');
			},
		);

		it.concurrent(
			'should handle code block content line with willEnd=true (apexdoc-code.ts lines 183-192)',
			() => {
				// Test when inCodeBlock=true, !startsWith(CODE_TAG), willEnd=true
				// This covers the ternary's true branch: willEnd ? {...} : nextState
				// Single line code block that ends immediately
				const lines = [
					' * {@code Integer x = 10; }', // Single line: starts and ends code block, willEnd=true
				];
				const result = processCodeBlockLines(lines);
				expect(result).toHaveLength(1);
				expect(result[0]).toContain('{@code');
				// This line: isCodeTagLine=true initially, then when processing content, willEnd=true
				// Actually, wait - this is a single line with {@code and }, so it starts the block
				// But the trimmed line starts with CODE_TAG, so isCodeContent will be false
				// Let me use a different test case - a multi-line where the closing brace is on the content line
				const lines2 = [
					' * {@code',
					' *   Integer x = 10; }', // Content line that ends the block (willEnd=true)
				];
				const result2 = processCodeBlockLines(lines2);
				expect(result2).toHaveLength(2);
				expect(result2[0]).toContain('{@code');
				// Second line: isCodeContent=true, willEnd=true, should use ternary's true branch
				// This exercises lines 183-192, specifically the true branch of the ternary (willEnd ? {...})
				expect(result2[1]).toContain('Integer x = 10;');
				expect(result2[1]).toContain('}');
				// Verify that the next line (if any) would not be in code block
				const lines3 = [
					' * {@code',
					' *   Integer x = 10; }', // Ends the block
					' * More text', // Should not be processed as code content
				];
				const result3 = processCodeBlockLines(lines3);
				expect(result3).toHaveLength(3);
				expect(result3[2]).toContain('More text');
			},
		);
	});
});
