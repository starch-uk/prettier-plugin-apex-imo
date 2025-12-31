/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect } from 'vitest';
import {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
	shouldForceMultiline,
} from '../src/utils.js';
import type { ApexNode } from '../src/types.js';

const nodeClassKey = '@class';

describe('utils', () => {
	describe('isListInit', () => {
		it('should identify NewListLiteral nodes', () => {
			expect(
				isListInit({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(true);
		});

		it('should identify NewSetLiteral nodes', () => {
			expect(
				isListInit({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [],
				}),
			).toBe(true);
		});

		it('should reject other node types', () => {
			expect(
				isListInit({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(false);
		});
	});

	describe('isMapInit', () => {
		it('should identify NewMapLiteral nodes', () => {
			expect(
				isMapInit({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(true);
		});

		it('should reject other node types', () => {
			expect(
				isMapInit({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(false);
		});
	});

	describe('hasMultipleListEntries', () => {
		it('should return false for empty list', () => {
			expect(
				hasMultipleListEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(false);
		});

		it('should return false for single item', () => {
			expect(
				hasMultipleListEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(false);
		});

		it('should return true for 2+ items', () => {
			expect(
				hasMultipleListEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(true);
		});

		it('should return true for set with 2+ items', () => {
			expect(
				hasMultipleListEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(true);
		});

		it('should handle null/undefined values gracefully', () => {
			const invalidValues: unknown = null;
			expect(
				hasMultipleListEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: invalidValues as ApexNode[],
				}),
			).toBe(false);
		});

		it('should handle non-array values gracefully', () => {
			const invalidValues: unknown = 'not an array';
			expect(
				hasMultipleListEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: invalidValues as ApexNode[],
				}),
			).toBe(false);
		});
	});

	describe('hasMultipleMapEntries', () => {
		it('should return false for empty map', () => {
			expect(
				hasMultipleMapEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(false);
		});

		it('should return false for single pair', () => {
			expect(
				hasMultipleMapEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [
						{
							[nodeClassKey]:
								'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
				}),
			).toBe(false);
		});

		it('should return true for 2+ pairs', () => {
			expect(
				hasMultipleMapEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [
						{
							[nodeClassKey]:
								'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
						},
						{
							[nodeClassKey]:
								'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
				}),
			).toBe(true);
		});

		it('should handle null/undefined pairs gracefully', () => {
			const invalidPairs: unknown = null;
			expect(
				hasMultipleMapEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: invalidPairs as ApexNode[],
				}),
			).toBe(false);
		});

		it('should handle non-array pairs gracefully', () => {
			const invalidPairs: unknown = 'not an array';
			expect(
				hasMultipleMapEntries({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: invalidPairs as ApexNode[],
				}),
			).toBe(false);
		});
	});

	describe('shouldForceMultiline', () => {
		it('should return true for list with multiple entries', () => {
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(true);
		});

		it('should return true for set with multiple entries', () => {
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(true);
		});

		it('should return true for map with multiple entries', () => {
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [
						{
							[nodeClassKey]:
								'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
						},
						{
							[nodeClassKey]:
								'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
				}),
			).toBe(true);
		});

		it('should return false for list with single entry', () => {
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(false);
		});

		it('should return false for set with single entry', () => {
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(false);
		});

		it('should return false for map with single entry', () => {
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [
						{
							[nodeClassKey]:
								'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
				}),
			).toBe(false);
		});

		it('should return false for empty list', () => {
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(false);
		});

		it('should return false for empty set', () => {
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [],
				}),
			).toBe(false);
		});

		it('should return false for empty map', () => {
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(false);
		});

		it('should return false for other nodes', () => {
			expect(
				shouldForceMultiline({
					[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
				}),
			).toBe(false);
		});

		it('should return false for null/undefined values', () => {
			const invalidValues: unknown = null;
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: invalidValues as ApexNode[],
				}),
			).toBe(false);
		});

		it('should return false for null/undefined pairs', () => {
			const invalidPairs: unknown = null;
			expect(
				shouldForceMultiline({
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: invalidPairs as ApexNode[],
				}),
			).toBe(false);
		});
	});
});
