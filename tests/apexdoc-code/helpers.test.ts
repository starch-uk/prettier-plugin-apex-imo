/**
 * @file Unit tests for helper functions in the apexdoc-code module.
 */

import { describe, it, expect } from 'vitest';
import {
	countBracesAndCheckEnd,
	shouldStartCodeBlock,
	processCodeContentLine,
	processRegularLine,
	computeNewCodeBlockState,
	processLineAsCodeContent,
	processLineAsRegular,
	processCodeBlockLines,
} from '../../src/apexdoc-code.js';

describe('apexdoc-code', () => {
	describe('countBracesAndCheckEnd', () => {
		it.concurrent('should count braces and detect code block end', () => {
			// Start with braceCount = 1 (from {@code opening)
			const result = countBracesAndCheckEnd('Integer x = 1; }', 1);
			expect(result.braceCount).toBe(0);
			expect(result.willEnd).toBe(true);
		});

		it.concurrent('should handle nested braces', () => {
			const result = countBracesAndCheckEnd('if (true) { x = 1; }', 1);
			expect(result.braceCount).toBe(1); // +1 from {, -1 from }
			expect(result.willEnd).toBe(false);
		});

		it.concurrent(
			'should handle code block ending on line with content',
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
			'should handle code block ending on line with content',
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
				// This should execute countBracesAndCheckEnd and willEndCodeBlock check
				expect(result[1]).toContain('Integer x = 1;');
				expect(result[1]).toContain('}');
			},
		);

		it.concurrent(
			'should handle code block content line with willEnd=false',
			() => {
				// Test when inCodeBlock=true, !startsWith(CODE_TAG), willEnd=false
				// This covers the ternary's false branch: willEnd ? {...} : nextState
				// Also tests return processLineAsCodeContent when isCodeContent=true
				// Lines should be: {@code, content line (willEnd=false), closing }
				const lines = [
					'{@code', // Starts code block, sets inCodeBlock=true, codeBlockBraceCount=1
					'  Integer x = 10;', // In code block, processes braces, willEnd=false (braceCount still 1)
					'}', // This line will set willEnd=true
				];
				const result = processCodeBlockLines(lines);
				expect(result).toHaveLength(3);
				expect(result[0]).toContain('{@code');
				// Second line: isCodeContent=true (newInCodeBlock=true && !isCodeTagLine), willEnd=false
				// This should trigger return processLineAsCodeContent(...)
				// This exercises the false branch of the ternary
				expect(result[1]).toContain('Integer x = 10;');
				expect(result[1]).not.toContain('}');
				expect(result[2]).toContain('}');
			},
		);

		it.concurrent(
			'should handle code block content line with willEnd=true',
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
				// This exercises the true branch of the ternary (willEnd ? {...})
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

	describe('shouldStartCodeBlock', () => {
		it.concurrent(
			'should return true when not in code block and line starts with code tag',
			() => {
				expect(shouldStartCodeBlock('{@code', false)).toBe(true);
			},
		);

		it.concurrent('should return false when already in code block', () => {
			expect(shouldStartCodeBlock('{@code', true)).toBe(false);
		});

		it.concurrent(
			'should return false when line does not start with code tag',
			() => {
				expect(shouldStartCodeBlock('regular line', false)).toBe(false);
			},
		);

		it.concurrent(
			'should be called and set state correctly in processCodeBlockLines',
			() => {
				// This test verifies code block starts correctly
				const lines = [' * {@code', ' *   Integer x = 10;', ' * }'];
				const result = processCodeBlockLines(lines);
				expect(result).toHaveLength(3);
				expect(result[0]).toContain('{@code');
				expect(result[1]).toContain('Integer x = 10;');
			},
		);
	});

	describe('processCodeContentLine', () => {
		it.concurrent(
			'should process code content line with willEnd=false',
			() => {
				const result = processCodeContentLine(
					'  Integer x = 10;',
					' *   Integer x = 10;',
					' ',
					1,
				);
				expect(result.codeBlockBraceCount).toBe(1);
				expect(result.willEnd).toBe(false);
				expect(result.processedLine).toContain('Integer x = 10;');
			},
		);

		it.concurrent(
			'should process code content line with willEnd=true',
			() => {
				const result = processCodeContentLine(
					'  Integer x = 1; }',
					' *   Integer x = 1; }',
					' ',
					1,
				);
				expect(result.codeBlockBraceCount).toBe(0);
				expect(result.willEnd).toBe(true);
				expect(result.processedLine).toContain('Integer x = 1;');
				expect(result.processedLine).toContain('}');
			},
		);

		it.concurrent('should handle nested braces in code content', () => {
			const result = processCodeContentLine(
				'  if (true) {',
				' *   if (true) {',
				' ',
				1,
			);
			expect(result.codeBlockBraceCount).toBe(2);
			expect(result.willEnd).toBe(false);
		});
	});

	describe('processRegularLine', () => {
		it.concurrent(
			'should process regular line with trimmed line when not last',
			() => {
				const result = processRegularLine(
					'regular line',
					' * regular line',
					' ',
					0,
					3,
				);
				expect(result).toBe(' regular line');
			},
		);

		it.concurrent('should process last line with trimStart', () => {
			const result = processRegularLine(
				'last line',
				' * last line',
				' ',
				2,
				3,
			);
			expect(result).toBe(' * last line');
		});

		it.concurrent('should handle first line with empty prefix', () => {
			const result = processRegularLine(
				'first line',
				' * first line',
				'',
				0,
				2,
			);
			expect(result).toBe('first line');
		});
	});

	describe('computeNewCodeBlockState', () => {
		it.concurrent(
			'should start code block when line starts with code tag and not in block',
			() => {
				const result = computeNewCodeBlockState('{@code', false, 0);
				expect(result.newInCodeBlock).toBe(true);
				expect(result.newBraceCount).toBe(1);
			},
		);

		it.concurrent(
			'should not start code block when already in block',
			() => {
				const result = computeNewCodeBlockState('{@code', true, 2);
				expect(result.newInCodeBlock).toBe(true);
				expect(result.newBraceCount).toBe(2);
			},
		);

		it.concurrent(
			'should not start code block when line does not start with code tag',
			() => {
				const result = computeNewCodeBlockState(
					'regular line',
					false,
					0,
				);
				expect(result.newInCodeBlock).toBe(false);
				expect(result.newBraceCount).toBe(0);
			},
		);

		it.concurrent(
			'should preserve brace count when not starting new block',
			() => {
				const result = computeNewCodeBlockState(
					'regular line',
					true,
					3,
				);
				expect(result.newInCodeBlock).toBe(true);
				expect(result.newBraceCount).toBe(3);
			},
		);
	});

	describe('processLineAsCodeContent', () => {
		it.concurrent(
			'should process code content line with willEnd=false',
			() => {
				const accumulator = {
					codeBlockBraceCount: 1,
					inCodeBlock: true,
					result: ['line1'],
				};
				const result = processLineAsCodeContent(
					accumulator,
					'  Integer x = 10;',
					' *   Integer x = 10;',
					' ',
					1,
				);
				expect(result.result).toHaveLength(2);
				expect(result.result[1]).toContain('Integer x = 10;');
				expect(result.inCodeBlock).toBe(true);
				expect(result.codeBlockBraceCount).toBe(1);
			},
		);

		it.concurrent(
			'should process code content line with willEnd=true',
			() => {
				const accumulator = {
					codeBlockBraceCount: 1,
					inCodeBlock: true,
					result: ['line1'],
				};
				const result = processLineAsCodeContent(
					accumulator,
					'  Integer x = 1; }',
					' *   Integer x = 1; }',
					' ',
					1,
				);
				expect(result.result).toHaveLength(2);
				expect(result.result[1]).toContain('Integer x = 1;');
				expect(result.inCodeBlock).toBe(false);
				expect(result.codeBlockBraceCount).toBe(0);
			},
		);
	});

	describe('processLineAsRegular', () => {
		it.concurrent('should process regular line when not last', () => {
			const accumulator = {
				codeBlockBraceCount: 0,
				inCodeBlock: false,
				result: ['line1'],
			};
			const result = processLineAsRegular(
				accumulator,
				'regular line',
				' * regular line',
				' ',
				1,
				3,
				false,
				0,
			);
			expect(result.result).toHaveLength(2);
			expect(result.result[1]).toBe(' regular line');
			expect(result.inCodeBlock).toBe(false);
			expect(result.codeBlockBraceCount).toBe(0);
		});

		it.concurrent('should process last line with trimStart', () => {
			const accumulator = {
				codeBlockBraceCount: 0,
				inCodeBlock: false,
				result: ['line1', 'line2'],
			};
			const result = processLineAsRegular(
				accumulator,
				'last line',
				' * last line',
				' ',
				2,
				3,
				false,
				0,
			);
			expect(result.result).toHaveLength(3);
			expect(result.result[2]).toBe(' * last line');
			expect(result.inCodeBlock).toBe(false);
			expect(result.codeBlockBraceCount).toBe(0);
		});

		it.concurrent('should preserve code block state', () => {
			const accumulator = {
				codeBlockBraceCount: 0,
				inCodeBlock: false,
				result: ['line1'],
			};
			const result = processLineAsRegular(
				accumulator,
				'regular line',
				' * regular line',
				' ',
				1,
				3,
				true,
				2,
			);
			expect(result.inCodeBlock).toBe(true);
			expect(result.codeBlockBraceCount).toBe(2);
		});
	});
});
