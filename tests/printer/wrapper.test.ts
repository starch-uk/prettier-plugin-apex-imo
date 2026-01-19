/**
 * @file Unit tests for the printer wrapper in the printer module.
 */

import { describe, it, expect, vi } from 'vitest';
import { createWrappedPrinter } from '../../src/printer.js';
import type { ApexNode } from '../../src/types.js';
import {
	createMockPath,
	createMockOptions,
	createMockPrint,
	createMockOriginalPrinter,
} from '../test-utils.js';
import {
	NODE_CLASS_KEY,
	createMockMethodDecl,
	createMockSetInit,
	createMockLiteralExpr,
} from '../mocks/nodes.js';

describe('printer', () => {
	describe('createWrappedPrinter', () => {
		it('should create a printer with print method', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			expect(wrapped).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- wrapped.print is a function property
			expect(typeof wrapped.print).toBe('function');
		});

		it('should pass through non-list/map nodes to original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = createMockPath(createMockMethodDecl());

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
			);

			expect(result).toBe('original output');
			expect(mockOriginalPrinter.print).toHaveBeenCalledWith(
				mockPath,
				createMockOptions(),
				expect.any(Function),
			);
		});

		it.concurrent.each([
			{
				description:
					'should intercept list nodes with multiple entries',
				expectNotOriginalOutput: true,
				nodeClass: 'apex.jorje.data.ast.NewObject$NewListLiteral',
				nodeData: {
					types: [],
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },

						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
				},
			},
			{
				description: 'should intercept set nodes with multiple entries',
				expectNotOriginalOutput: false,
				nodeClass: 'apex.jorje.data.ast.NewObject$NewSetLiteral',
				nodeData: {
					types: [],
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },

						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
				},
			},
			{
				description: 'should intercept map nodes with multiple entries',
				expectNotOriginalOutput: false,
				nodeClass: 'apex.jorje.data.ast.NewObject$NewMapLiteral',
				nodeData: {
					pairs: [
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
					types: [],
				},
			},
		])(
			'$description',
			({
				nodeClass,
				nodeData,
				expectNotOriginalOutput,
			}: Readonly<{
				description: string;
				nodeClass: string;
				nodeData: Readonly<Record<string, unknown>>;
				expectNotOriginalOutput: boolean;
			}>) => {
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const mockPath = createMockPath({
					...nodeData,
					[NODE_CLASS_KEY]: nodeClass,
				} as ApexNode);

				// Mock the path.map to return empty arrays
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock function type assertion
				(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce(
					[],
				);
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock function type assertion
				(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce(
					[],
				);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should not call original printer for multiline collections
				expect(mockOriginalPrinter.print).not.toHaveBeenCalled();
				// Should return a doc structure
				expect(result).toBeDefined();
				if (expectNotOriginalOutput) {
					expect(result).not.toBe('original output');
				}
			},
		);

		it.concurrent.each([
			{
				description:
					'should pass through list nodes with single entry to original printer',
				nodeClass: 'apex.jorje.data.ast.NewObject$NewListLiteral',
				nodeData: {
					values: [{ '@class': 'apex.jorje.data.ast.LiteralExpr' }],
				},
			},
			{
				description:
					'should pass through map nodes with single entry to original printer',
				nodeClass: 'apex.jorje.data.ast.NewObject$NewMapLiteral',
				nodeData: {
					pairs: [
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
				},
			},
		])(
			'$description',
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
			({
				nodeClass,
				nodeData,
			}: {
				description: string;
				nodeClass: string;
				nodeData: Readonly<Record<string, unknown>>;
			}) => {
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const mockPath = createMockPath({
					...nodeData,
					[NODE_CLASS_KEY]: nodeClass,
				} as ApexNode);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should call original printer for single-entry collections
				expect(mockOriginalPrinter.print).toHaveBeenCalled();
				expect(result).toBe('original output');
			},
		);

		it('should pass through set nodes with single entry to original printer', () => {
			const mockOriginalPrinter = createMockOriginalPrinter();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = createMockPath(
				createMockSetInit([createMockLiteralExpr()]),
			);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
			);

			// Should call original printer for single-item sets
			expect(mockOriginalPrinter.print).toHaveBeenCalled();
			expect(result).toBe('original output');
		});

		it.concurrent.each([
			{
				description:
					'should handle empty list nodes with custom formatting',
				nodeClass: 'apex.jorje.data.ast.NewObject$NewListLiteral',
				nodeData: { values: [] },
			},
			{
				description:
					'should handle empty set nodes with custom formatting',
				nodeClass: 'apex.jorje.data.ast.NewObject$NewSetLiteral',
				nodeData: { values: [] },
			},
			{
				description:
					'should handle empty map nodes with custom formatting',
				nodeClass: 'apex.jorje.data.ast.NewObject$NewMapLiteral',
				nodeData: { pairs: [] },
			},
		])(
			'$description',
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
			({
				nodeClass,
				nodeData,
			}: {
				description: string;
				nodeClass: string;
				nodeData: Readonly<Record<string, unknown>>;
			}) => {
				const mockOriginalPrinter = {
					print: vi.fn(() => 'original output'),
				};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrapped = createWrappedPrinter(mockOriginalPrinter);

				const mockPath = createMockPath({
					...nodeData,
					[NODE_CLASS_KEY]: nodeClass,
				} as ApexNode);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
				const result = wrapped.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Empty collections are handled by our custom logic to ensure
				// type parameters can break when they exceed printWidth
				// They should return a Doc array, not the original output
				expect(mockOriginalPrinter.print).not.toHaveBeenCalled();
				expect(result).not.toBe('original output');
				// Result should be a Doc array (our custom formatting)
				expect(Array.isArray(result)).toBe(true);
			},
		);
	});
});
