/**
 * @file Tests for formatApexCodeWithFallback with mocked prettier.format.
 *
 * Tests the fallback parser paths by passing a mock format function directly
 * to formatApexCodeWithFallback. Each test gets its own mock instance to allow
 * concurrent execution.
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- Test file needs type assertions for mock options */
import { describe, it, expect, vi } from 'vitest';
import type { ParserOptions } from 'prettier';
import { formatApexCodeWithFallback } from '../src/utils.js';

describe('formatApexCodeWithFallback with mocked prettier.format', () => {
	it('should return result from apex parser when apex-anonymous fails', async () => {
		const code = 'Integer x = 10;';

		/**
		 * The formatted result from the parser.
		 */
		const formattedResult = 'Integer x = 10;';

		// Create a fresh mock for this test - allows concurrent execution
		const mockFormat = vi
			.fn()
			.mockRejectedValueOnce(new Error('Parser error'))
			.mockResolvedValueOnce(formattedResult);

		const result = await formatApexCodeWithFallback(
			code,
			{
				parser: 'apex',
				plugins: [],
			} as unknown as Readonly<ParserOptions & { plugins?: unknown[] }>,
			mockFormat,
		);

		// Should return result from second parser
		expect(result).toBe(formattedResult);
		// Check that it was called twice
		expect(mockFormat).toHaveBeenCalledTimes(2);
		// Verify calls with expected arguments
		const apexAnonymousCall = mockFormat.mock.calls.find(
			(
				call: readonly unknown[],
			): call is [string, { parser: string }] => {
				const [, options] = call;
				return (
					typeof options === 'object' &&
					options !== null &&
					'parser' in options &&
					typeof (options as { parser?: unknown }).parser ===
						'string' &&
					(options as { parser: string }).parser === 'apex-anonymous'
				);
			},
		);
		const apexCall = mockFormat.mock.calls.find(
			(
				call: readonly unknown[],
			): call is [string, { parser: string }] => {
				const [, options] = call;
				return (
					typeof options === 'object' &&
					options !== null &&
					'parser' in options &&
					typeof (options as { parser?: unknown }).parser ===
						'string' &&
					(options as { parser: string }).parser === 'apex'
				);
			},
		);
		expect(apexAnonymousCall).toBeDefined();
		expect(apexCall).toBeDefined();
		if (apexAnonymousCall) {
			expect(apexAnonymousCall[0]).toBe(code);
		}
		if (apexCall) {
			expect(apexCall[0]).toBe(code);
		}
	});

	it('should return original code when both parsers fail', async () => {
		const code = '!!!INVALID!!!';

		// Create a fresh mock for this test - allows concurrent execution
		// Mock: both calls fail - use mockImplementation to ensure it always throws
		const mockFormat = vi.fn().mockImplementation(() => {
			throw new Error('Parser error');
		});

		const result = await formatApexCodeWithFallback(
			code,
			{
				parser: 'apex',
				plugins: [],
			} as unknown as Readonly<ParserOptions & { plugins?: unknown[] }>,
			mockFormat,
		);

		// Should return original code when both parsers fail
		expect(result).toBe(code);
		// Verify it was called (at least once, possibly twice)
		expect(mockFormat).toHaveBeenCalled();
	});

	it('should return result from apex-anonymous parser when it succeeds', async () => {
		const code = 'Integer x = 10;';

		/**
		 * The formatted result from the parser.
		 */
		const formattedResult = 'Integer x = 10;';

		// Create a fresh mock for this test - allows concurrent execution
		// Mock: first call succeeds
		const mockFormat = vi.fn().mockResolvedValueOnce(formattedResult);

		const result = await formatApexCodeWithFallback(
			code,
			{
				parser: 'apex',
				plugins: [],
			} as unknown as Readonly<ParserOptions & { plugins?: unknown[] }>,
			mockFormat,
		);

		// Should return result from first parser
		expect(result).toBe(formattedResult);
		// Check that it was called once
		expect(mockFormat).toHaveBeenCalledTimes(1);
		// Verify it was called with the expected arguments (find the call with 'apex-anonymous')
		const apexAnonymousCall = mockFormat.mock.calls.find(
			(
				call: readonly unknown[],
			): call is [string, { parser: string }] => {
				const [, options] = call;
				return (
					typeof options === 'object' &&
					options !== null &&
					'parser' in options &&
					typeof (options as { parser?: unknown }).parser ===
						'string' &&
					(options as { parser: string }).parser === 'apex-anonymous'
				);
			},
		);
		expect(apexAnonymousCall).toBeDefined();
		if (apexAnonymousCall) {
			expect(apexAnonymousCall[0]).toBe(code);
			expect(apexAnonymousCall[1]).toMatchObject({
				parser: 'apex-anonymous',
				plugins: [],
			});
		}
	});
});
