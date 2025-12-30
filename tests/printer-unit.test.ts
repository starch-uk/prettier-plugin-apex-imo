import { describe, it, expect, vi } from 'vitest';
import { createWrappedPrinter } from '../src/printer.js';
import type { ApexNode } from '../src/types.js';

describe('printer', () => {
	describe('createWrappedPrinter', () => {
		it('should create a printer with print method', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			expect(wrapped).toBeDefined();
			expect(typeof wrapped.print).toBe('function');
		});

		it('should pass through non-list/map nodes to original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = {
				node: {
					'@class': 'apex.jorje.data.ast.MethodDecl',
				} as ApexNode,
			};

			const result = wrapped.print(
				mockPath as never,
				{} as never,
				vi.fn() as never,
			);

			expect(result).toBe('original output');
			expect(mockOriginalPrinter.print).toHaveBeenCalledWith(
				mockPath,
				{},
				expect.any(Function),
			);
		});

		it('should intercept list nodes with multiple entries', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = {
				node: {
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
					types: [],
				} as ApexNode,
				map: vi.fn(() => []),
			};

			// Mock the path.map to return empty arrays for types and values
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);

			const result = wrapped.print(
				mockPath as never,
				{} as never,
				vi.fn() as never,
			);

			// Should not call original printer for multiline lists
			expect(mockOriginalPrinter.print).not.toHaveBeenCalled();
			// Should return a doc structure (not the original output)
			expect(result).toBeDefined();
			expect(result).not.toBe('original output');
		});

		it('should intercept set nodes with multiple entries', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = {
				node: {
					'@class': 'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
					types: [],
				} as ApexNode,
				map: vi.fn(() => []),
			};

			// Mock the path.map to return empty arrays for types and values
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);

			const result = wrapped.print(
				mockPath as never,
				{} as never,
				vi.fn() as never,
			);

			// Should not call original printer for multiline sets
			expect(mockOriginalPrinter.print).not.toHaveBeenCalled();
			// Should return a doc structure
			expect(result).toBeDefined();
		});

		it('should intercept map nodes with multiple entries', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = {
				node: {
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
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
				} as ApexNode,
				map: vi.fn(() => []),
			};

			// Mock the path.map to return empty arrays for types and pairs
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);

			const result = wrapped.print(
				mockPath as never,
				{} as never,
				vi.fn() as never,
			);

			// Should not call original printer for multiline maps
			expect(mockOriginalPrinter.print).not.toHaveBeenCalled();
			// Should return a doc structure
			expect(result).toBeDefined();
		});

		it('should pass through list nodes with single entry to original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = {
				node: {
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [{ '@class': 'apex.jorje.data.ast.LiteralExpr' }],
				} as ApexNode,
			};

			const result = wrapped.print(
				mockPath as never,
				{} as never,
				vi.fn() as never,
			);

			// Should call original printer for single-item lists
			expect(mockOriginalPrinter.print).toHaveBeenCalled();
			expect(result).toBe('original output');
		});

		it('should pass through map nodes with single entry to original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = {
				node: {
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
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
				} as ApexNode,
			};

			const result = wrapped.print(
				mockPath as never,
				{} as never,
				vi.fn() as never,
			);

			// Should call original printer for single-pair maps
			expect(mockOriginalPrinter.print).toHaveBeenCalled();
			expect(result).toBe('original output');
		});

		it('should preserve other properties from original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(),
				embed: vi.fn(),
				preprocess: vi.fn(),
				otherProp: 'test',
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			expect(wrapped.embed).toBe(mockOriginalPrinter.embed);
			expect(wrapped.preprocess).toBe(mockOriginalPrinter.preprocess);
			expect((wrapped as { otherProp?: string }).otherProp).toBe('test');
		});

		it('should pass through set nodes with single entry to original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = {
				node: {
					'@class': 'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [{ '@class': 'apex.jorje.data.ast.LiteralExpr' }],
				} as ApexNode,
			};

			const result = wrapped.print(
				mockPath as never,
				{} as never,
				vi.fn() as never,
			);

			// Should call original printer for single-item sets
			expect(mockOriginalPrinter.print).toHaveBeenCalled();
			expect(result).toBe('original output');
		});

		it('should pass through empty list nodes to original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = {
				node: {
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				} as ApexNode,
			};

			const result = wrapped.print(
				mockPath as never,
				{} as never,
				vi.fn() as never,
			);

			// Should call original printer for empty lists
			expect(mockOriginalPrinter.print).toHaveBeenCalled();
			expect(result).toBe('original output');
		});

		it('should pass through empty set nodes to original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = {
				node: {
					'@class': 'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [],
				} as ApexNode,
			};

			const result = wrapped.print(
				mockPath as never,
				{} as never,
				vi.fn() as never,
			);

			// Should call original printer for empty sets
			expect(mockOriginalPrinter.print).toHaveBeenCalled();
			expect(result).toBe('original output');
		});

		it('should pass through empty map nodes to original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = {
				node: {
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				} as ApexNode,
			};

			const result = wrapped.print(
				mockPath as never,
				{} as never,
				vi.fn() as never,
			);

			// Should call original printer for empty maps
			expect(mockOriginalPrinter.print).toHaveBeenCalled();
			expect(result).toBe('original output');
		});
	});
});
