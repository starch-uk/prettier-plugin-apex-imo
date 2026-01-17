/**
 * @file Tests for the printer module.
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect } from 'vitest';
import {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
	isCollectionAssignment,
	LIST_LITERAL_CLASS,
	SET_LITERAL_CLASS,
	MAP_LITERAL_CLASS,
} from '../src/collections.js';
import type {
	ApexNode,
	ApexListInitNode,
	ApexMapInitNode,
} from '../src/types.js';
import { createMockPath } from './test-utils.js';

const nodeClassKey = '@class';

describe('utils', () => {
	describe('isListInit', () => {
		it.concurrent.each([
			{
				desc: 'identifies NewListLiteral nodes',
				expected: true,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				} as Readonly<ApexNode>,
			},
			{
				desc: 'identifies NewSetLiteral nodes',
				expected: true,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [],
				} as Readonly<ApexNode>,
			},
			{
				desc: 'rejects other node types',
				expected: false,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				} as Readonly<ApexNode>,
			},
		])(
			'$desc',
			({
				node,
				expected,
			}: Readonly<{
				node: Readonly<ApexNode>;
				expected: boolean;
			}>) => {
				expect(isListInit(node)).toBe(expected);
			},
		);
	});

	describe('isMapInit', () => {
		it.concurrent.each([
			{
				desc: 'identifies NewMapLiteral nodes',
				expected: true,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				} as Readonly<ApexNode>,
			},
			{
				desc: 'rejects other node types',
				expected: false,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				} as Readonly<ApexNode>,
			},
		])(
			'$desc',
			({
				node,
				expected,
			}: Readonly<{
				node: Readonly<ApexNode>;
				expected: boolean;
			}>) => {
				expect(isMapInit(node)).toBe(expected);
			},
		);
	});

	describe('hasMultipleListEntries', () => {
		it.concurrent.each([
			{
				desc: 'returns false for empty list',
				expected: false,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				} as Readonly<ApexListInitNode>,
			},
			{
				desc: 'returns false for single item',
				expected: false,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					],
				} as Readonly<ApexListInitNode>,
			},
			{
				desc: 'returns true for 2+ items',
				expected: true,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					],
				} as Readonly<ApexListInitNode>,
			},
			{
				desc: 'returns true for set with 2+ items',
				expected: true,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
						{ [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
					],
				} as Readonly<ApexListInitNode>,
			},
			{
				desc: 'handles null/undefined values gracefully',
				expected: false,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: null as unknown as ApexNode[],
				} as Readonly<ApexListInitNode>,
			},
			{
				desc: 'handles non-array values gracefully',
				expected: false,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: 'not an array' as unknown as ApexNode[],
				} as Readonly<ApexListInitNode>,
			},
		])(
			'$desc',
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- it.each provides readonly data
			({
				node,
				expected,
			}: Readonly<{
				node: Readonly<ApexListInitNode>;
				expected: boolean;
			}>) => {
				expect(hasMultipleListEntries(node)).toBe(expected);
			},
		);
	});

	describe('hasMultipleMapEntries', () => {
		const singlePair = [
			{
				key: { [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
				[nodeClassKey]: 'apex.jorje.data.ast.MapLiteralKeyValue',
				value: { [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
			},
		];
		const twoPairs = [
			...singlePair,
			{
				key: { [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
				[nodeClassKey]: 'apex.jorje.data.ast.MapLiteralKeyValue',
				value: { [nodeClassKey]: 'apex.jorje.data.ast.LiteralExpr' },
			},
		];

		it.concurrent.each([
			{
				desc: 'returns false for empty map',
				expected: false,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				} as Readonly<ApexMapInitNode>,
			},
			{
				desc: 'returns false for single pair',
				expected: false,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: singlePair,
				} as Readonly<ApexMapInitNode>,
			},
			{
				desc: 'returns true for 2+ pairs',
				expected: true,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: twoPairs,
				} as Readonly<ApexMapInitNode>,
			},
			{
				desc: 'handles null/undefined pairs gracefully',
				expected: false,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: null as unknown as ApexNode[],
				} as Readonly<ApexMapInitNode>,
			},
			{
				desc: 'handles non-array pairs gracefully',
				expected: false,
				node: {
					[nodeClassKey]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: 'not an array' as unknown as ApexNode[],
				} as Readonly<ApexMapInitNode>,
			},
		])(
			'$desc',
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- it.each provides readonly data
			({
				node,
				expected,
			}: Readonly<{
				node: Readonly<ApexMapInitNode>;
				expected: boolean;
			}>) => {
				expect(hasMultipleMapEntries(node)).toBe(expected);
			},
		);
	});

	describe('isCollectionAssignment', () => {
		const LIST_LITERAL_CLASS =
			'apex.jorje.data.ast.NewObject$NewListLiteral';
		const SET_LITERAL_CLASS = 'apex.jorje.data.ast.NewObject$NewSetLiteral';
		const MAP_LITERAL_CLASS = 'apex.jorje.data.ast.NewObject$NewMapLiteral';
		const NEW_EXPR_CLASS = 'apex.jorje.data.ast.Expr$NewExpr';

		it.concurrent.each([
			{
				desc: 'identifies List literal assignment',
				expected: true,
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: {
							'@class': LIST_LITERAL_CLASS,
						},
					},
				},
			},
			{
				desc: 'identifies Set literal assignment',
				expected: true,
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: {
							'@class': SET_LITERAL_CLASS,
						},
					},
				},
			},
			{
				desc: 'identifies Map literal assignment',
				expected: true,
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: {
							'@class': MAP_LITERAL_CLASS,
						},
					},
				},
			},
			{
				desc: 'rejects non-object assignment',
				expected: false,
				assignment: 'not an object',
			},
			{
				desc: 'rejects assignment without value property',
				expected: false,
				assignment: {},
			},
			{
				desc: 'rejects assignment with null value',
				expected: false,
				assignment: {
					value: null,
				},
			},
			{
				desc: 'rejects assignment with non-NewExpr value',
				expected: false,
				assignment: {
					value: {
						'@class': 'apex.jorje.data.ast.LiteralExpr',
					},
				},
			},
			{
				desc: 'rejects assignment with null creator',
				expected: false,
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: null,
					},
				},
			},
			{
				desc: 'rejects assignment with non-collection creator',
				expected: false,
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: {
							'@class': 'apex.jorje.data.ast.Identifier',
						},
					},
				},
			},
		])(
			'$desc',
			({
				assignment,
				expected,
			}: Readonly<{
				assignment: unknown;
				expected: boolean;
			}>) => {
				expect(isCollectionAssignment(assignment)).toBe(expected);
			},
		);

		it.concurrent(
			'should handle assignment with missing creator property',
			() => {
				const assignment = {
					value: {
						'@class': 'apex.jorje.data.ast.Expr$NewExpr',
						// Missing creator property
					},
				};
				expect(isCollectionAssignment(assignment)).toBe(false);
			},
		);

		it.concurrent(
			'should handle assignment with non-object creator',
			() => {
				const assignment = {
					value: {
						'@class': 'apex.jorje.data.ast.Expr$NewExpr',
						creator: 'not an object',
					},
				};
				expect(isCollectionAssignment(assignment)).toBe(false);
			},
		);

		it.concurrent(
			'should handle assignment with creator without @class property',
			() => {
				const assignment = {
					value: {
						'@class': 'apex.jorje.data.ast.Expr$NewExpr',
						creator: {},
					},
				};
				expect(isCollectionAssignment(assignment)).toBe(false);
			},
		);
	});
});
