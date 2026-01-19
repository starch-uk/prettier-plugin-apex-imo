/**
 * @file Integration tests for annotation handling in the printer module.
 *
 * Tests that the printer wrapper correctly integrates with annotation printing logic.
 * Normalization details are tested in annotations.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { createWrappedPrinter } from '../../src/printer.js';
import {
	createMockPath,
	createMockOptions,
	createMockPrint,
	createMockOriginalPrinter,
} from '../test-utils.js';
import {
	createMockAnnotation,
	createMockAnnotationStringParameter,
} from '../mocks/nodes.js';

describe('printer', () => {
	describe('annotation integration', () => {
		it.concurrent(
			'should use custom annotation printing for annotation nodes',
			() => {
				const mockNode = createMockAnnotation('test', []);

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrappedPrinter =
					createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
				const result = wrappedPrinter.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should use custom annotation printing (not original printer)
				expect(result).not.toBe('original output');
				// Verify it's using the annotation printing logic
				if (Array.isArray(result)) {
					expect(result[0]).toBe('@');
				}
			},
		);

		it.concurrent('should handle annotations with parameters', () => {
			const mockNode = createMockAnnotation('test', [
				createMockAnnotationStringParameter('value'),
			]);

			const mockPath = createMockPath(mockNode);
			const mockOriginalPrinter = createMockOriginalPrinter();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
			const wrappedPrinter = createWrappedPrinter(mockOriginalPrinter);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
			const result = wrappedPrinter.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
			);

			// Should handle annotations with parameters
			expect(result).not.toBe('original output');
		});
	});
});
