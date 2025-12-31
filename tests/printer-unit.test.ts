/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types, @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect, vi } from 'vitest';
import type { AstPath, ParserOptions, Doc } from 'prettier';
import { createWrappedPrinter } from '../src/printer.js';
import type { ApexNode } from '../src/types.js';

const nodeClassKey = '@class';

// Helper function to create type-safe mock path
function createMockPath(node: Readonly<ApexNode>): AstPath<ApexNode> {
	const mockPath = {
		node,
		map: vi.fn(() => []),
		call: vi.fn(() => ''),
	};
	return mockPath as AstPath<ApexNode>;
}

// Helper function to create type-safe mock options
function createMockOptions(): Readonly<ParserOptions> {
	return {} as Readonly<ParserOptions>;
}

// Helper function to create type-safe mock print function
function createMockPrint(): Readonly<
	(path: Readonly<AstPath<ApexNode>>) => Doc
> {
	const mockPrint = vi.fn(() => '');
	return mockPrint as (path: Readonly<AstPath<ApexNode>>) => Doc;
}

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

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
			} as ApexNode);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
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

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.NewObject$NewListLiteral',
				values: [
					{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
				],
				types: [],
			} as ApexNode);

			// Mock the path.map to return empty arrays for types and values
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
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

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.NewObject$NewSetLiteral',
				values: [
					{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
				],
				types: [],
			} as ApexNode);

			// Mock the path.map to return empty arrays for types and values
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
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

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.NewObject$NewMapLiteral',
				pairs: [
					{
						[nodeClassKey]:
							'apex.jorje.data.ast.MapLiteralKeyValue',
						key: {
							[nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr',
						},
						value: {
							[nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr',
						},
					},
					{
						[nodeClassKey]:
							'apex.jorje.data.ast.MapLiteralKeyValue',
						key: {
							[nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr',
						},
						value: {
							[nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr',
						},
					},
				],
				types: [],
			} as ApexNode);

			// Mock the path.map to return empty arrays for types and pairs
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);
			(mockPath.map as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
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

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.NewObject$NewListLiteral',
				values: [{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' }],
			} as ApexNode);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
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

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.NewObject$NewMapLiteral',
				pairs: [
					{
						[nodeClassKey]:
							'apex.jorje.data.ast.MapLiteralKeyValue',
						key: {
							[nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr',
						},
						value: {
							[nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr',
						},
					},
				],
			} as ApexNode);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
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
			const wrappedWithProps = wrapped as { otherProp?: string };
			expect(wrappedWithProps.otherProp).toBe('test');
		});

		it('should pass through set nodes with single entry to original printer', () => {
			const mockOriginalPrinter = {
				print: vi.fn(() => 'original output'),
			};

			const wrapped = createWrappedPrinter(mockOriginalPrinter);

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.NewObject$NewSetLiteral',
				values: [{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' }],
			} as ApexNode);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
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

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.NewObject$NewListLiteral',
				values: [],
			} as ApexNode);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
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

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.NewObject$NewSetLiteral',
				values: [],
			} as ApexNode);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
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

			const mockPath = createMockPath({
				[nodeClassKey]: 'apex.jorje.data.ast.NewObject$NewMapLiteral',
				pairs: [],
			} as ApexNode);

			const result = wrapped.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
			);

			// Should call original printer for empty maps
			expect(mockOriginalPrinter.print).toHaveBeenCalled();
			expect(result).toBe('original output');
		});
	});
});
