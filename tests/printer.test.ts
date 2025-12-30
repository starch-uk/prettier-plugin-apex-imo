import { describe, it, expect } from 'vitest';
import {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
	shouldForceMultiline,
} from '../src/utils.js';
import type { ApexNode } from '../src/types.js';

describe('utils', () => {
	describe('isListInit', () => {
		it('should identify NewListLiteral nodes', () => {
			expect(
				isListInit({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(true);
		});

		it('should identify NewSetLiteral nodes', () => {
			expect(
				isListInit({
					'@class': 'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [],
				}),
			).toBe(true);
		});

		it('should reject other node types', () => {
			expect(
				isListInit({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(false);
		});
	});

	describe('isMapInit', () => {
		it('should identify NewMapLiteral nodes', () => {
			expect(
				isMapInit({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(true);
		});

		it('should reject other node types', () => {
			expect(
				isMapInit({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(false);
		});
	});

	describe('hasMultipleListEntries', () => {
		it('should return false for empty list', () => {
			expect(
				hasMultipleListEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(false);
		});

		it('should return false for single item', () => {
			expect(
				hasMultipleListEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [{ '@class': 'apex.jorje.data.ast.LiteralExpr' }],
				}),
			).toBe(false);
		});

		it('should return true for 2+ items', () => {
			expect(
				hasMultipleListEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(true);
		});

		it('should return true for set with 2+ items', () => {
			expect(
				hasMultipleListEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(true);
		});

		it('should handle null/undefined values gracefully', () => {
			expect(
				hasMultipleListEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: null as unknown as ApexNode[],
				}),
			).toBe(false);
		});

		it('should handle non-array values gracefully', () => {
			expect(
				hasMultipleListEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: 'not an array' as unknown as ApexNode[],
				}),
			).toBe(false);
		});
	});

	describe('hasMultipleMapEntries', () => {
		it('should return false for empty map', () => {
			expect(
				hasMultipleMapEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(false);
		});

		it('should return false for single pair', () => {
			expect(
				hasMultipleMapEntries({
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
				}),
			).toBe(false);
		});

		it('should return true for 2+ pairs', () => {
			expect(
				hasMultipleMapEntries({
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
				}),
			).toBe(true);
		});

		it('should handle null/undefined pairs gracefully', () => {
			expect(
				hasMultipleMapEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: null as unknown as ApexNode[],
				}),
			).toBe(false);
		});

		it('should handle non-array pairs gracefully', () => {
			expect(
				hasMultipleMapEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: 'not an array' as unknown as ApexNode[],
				}),
			).toBe(false);
		});
	});

	describe('shouldForceMultiline', () => {
		it('should return true for list with multiple entries', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(true);
		});

		it('should return true for set with multiple entries', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(true);
		});

		it('should return true for map with multiple entries', () => {
			expect(
				shouldForceMultiline({
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
				}),
			).toBe(true);
		});

		it('should return false for list with single entry', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [{ '@class': 'apex.jorje.data.ast.LiteralExpr' }],
				}),
			).toBe(false);
		});

		it('should return false for set with single entry', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [{ '@class': 'apex.jorje.data.ast.LiteralExpr' }],
				}),
			).toBe(false);
		});

		it('should return false for map with single entry', () => {
			expect(
				shouldForceMultiline({
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
				}),
			).toBe(false);
		});

		it('should return false for empty list', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(false);
		});

		it('should return false for empty set', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [],
				}),
			).toBe(false);
		});

		it('should return false for empty map', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(false);
		});

		it('should return false for other nodes', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.MethodDecl',
				}),
			).toBe(false);
		});

		it('should return false for null/undefined values', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: null as unknown as ApexNode[],
				}),
			).toBe(false);
		});

		it('should return false for null/undefined pairs', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: null as unknown as ApexNode[],
				}),
			).toBe(false);
		});
	});
});
