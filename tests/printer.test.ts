import { describe, it, expect } from 'vitest';
import {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
	shouldForceMultiline,
} from '../src/utils.js';

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

		it('should return false for other nodes', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.MethodDecl',
				}),
			).toBe(false);
		});
	});
});
