/**
 * @file Tests for formatApexCodeWithFallback with mocked prettier.format.
 *
 * This file uses vi.mock to mock prettier.format, allowing us to test
 * the fallback parser paths that are difficult to trigger with real parsers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParserOptions } from 'prettier';

// Mock prettier module for this test file - must be hoisted
const mockFormat = vi.fn();
vi.mock('prettier', async () => {
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- import() type is required for typeof import()
	const actual = await vi.importActual<typeof import('prettier')>('prettier');
	return {
		...actual,
		// eslint-disable-next-line @typescript-eslint/require-await -- Mock function signature
		format: async (
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Mock function parameters
			...args: Parameters<typeof actual.format>
		): Promise<ReturnType<typeof actual.format>> =>
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock function return value
			mockFormat(...args),
	};
});

// Import after mock is set up
import { formatApexCodeWithFallback } from '../src/utils.js';

describe('formatApexCodeWithFallback with mocked prettier.format', () => {
	beforeEach(() => {
		mockFormat.mockClear();
	});

	it('should return result from apex parser when apex-anonymous fails (line 180)', async () => {
		const code = 'Integer x = 10;';

		/**
		 * The formatted result from the parser.
		 */
		const formattedResult = 'Integer x = 10;';

		// Mock: first call (apex-anonymous) fails, second call (apex) succeeds
		mockFormat
			.mockRejectedValueOnce(new Error('Parser error'))
			.mockResolvedValueOnce(formattedResult);

		const result = await formatApexCodeWithFallback(code, {
			parser: 'apex',
			plugins: [],
		});

		// Should return result from second parser (line 180)
		expect(result).toBe(formattedResult);
		expect(mockFormat).toHaveBeenCalledTimes(2);
		// First call with apex-anonymous
		expect(mockFormat).toHaveBeenNthCalledWith(1, code, {
			parser: 'apex-anonymous',
			plugins: [],
		});
		// Second call with apex
		expect(mockFormat).toHaveBeenNthCalledWith(2, code, {
			parser: 'apex',
			plugins: [],
		});
	});

	it('should return original code when both parsers fail', async () => {
		const code = '!!!INVALID!!!';

		// Mock: both calls fail
		mockFormat
			.mockRejectedValueOnce(new Error('Parser error 1'))
			.mockRejectedValueOnce(new Error('Parser error 2'));

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
		const result = await formatApexCodeWithFallback(code, {
			parser: 'apex',
			plugins: [],
		} as Readonly<ParserOptions & { plugins?: unknown[] }>);

		// Should return original code when both parsers fail
		expect(result).toBe(code);
		expect(mockFormat).toHaveBeenCalledTimes(2);
	});

	it('should return result from apex-anonymous parser when it succeeds', async () => {
		const code = 'Integer x = 10;';

		/**
		 * The formatted result from the parser.
		 */
		const formattedResult = 'Integer x = 10;';

		// Mock: first call succeeds
		mockFormat.mockResolvedValueOnce(formattedResult);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock options for test
		const result = await formatApexCodeWithFallback(code, {
			parser: 'apex',
			plugins: [],
		} as Readonly<ParserOptions & { plugins?: unknown[] }>);

		// Should return result from first parser
		expect(result).toBe(formattedResult);
		expect(mockFormat).toHaveBeenCalledTimes(1);
		expect(mockFormat).toHaveBeenCalledWith(code, {
			parser: 'apex-anonymous',
			plugins: [],
		});
	});
});
