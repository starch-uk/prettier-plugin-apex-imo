/**
 * @file Tests for the collections module.
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect } from 'vitest';
import {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
	isCollectionAssignment,
} from '../src/collections.js';
import type {
	ApexNode,
	ApexListInitNode,
	ApexMapInitNode,
} from '../src/types.js';
import {
	NODE_CLASS_KEY,
	createMockListInit,
	createMockSetInit,
	createMockMapInit,
	createMockLiteralExpr,
	createMockMapLiteralKeyValue,
} from './mocks/nodes.js';

describe('collections', () => {
	describe('isListInit', () => {
		it.concurrent.each([
			{
				desc: 'identifies NewListLiteral nodes',
				expected: true,
				node: createMockListInit([]),
			},
			{
				desc: 'identifies NewSetLiteral nodes',
				expected: true,
				node: createMockSetInit([]),
			},
			{
				desc: 'rejects other node types',
				expected: false,
				node: createMockMapInit([]),
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
				node: createMockMapInit([]),
			},
			{
				desc: 'rejects other node types',
				expected: false,
				node: createMockListInit([]),
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
		const singleValue = [createMockLiteralExpr()];
		const twoValues = [createMockLiteralExpr(), createMockLiteralExpr()];

		it.concurrent.each([
			{
				desc: 'returns false for empty list',
				expected: false,
				node: createMockListInit([]),
			},
			{
				desc: 'returns false for single item',
				expected: false,
				node: createMockListInit(singleValue),
			},
			{
				desc: 'returns true for 2+ items',
				expected: true,
				node: createMockListInit(twoValues),
			},
			{
				desc: 'returns true for set with 2+ items',
				expected: true,
				node: createMockSetInit(twoValues),
			},
			{
				desc: 'handles null/undefined values gracefully',
				expected: false,
				node: {
					[NODE_CLASS_KEY]:
						'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: null as unknown as ApexNode[],
				} as Readonly<ApexListInitNode>,
			},
			{
				desc: 'handles non-array values gracefully',
				expected: false,
				node: {
					[NODE_CLASS_KEY]:
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
		const literalExpr = createMockLiteralExpr();
		const singlePair = [
			createMockMapLiteralKeyValue(literalExpr, literalExpr),
		];
		const twoPairs = [
			...singlePair,
			createMockMapLiteralKeyValue(literalExpr, literalExpr),
		];

		it.concurrent.each([
			{
				desc: 'returns false for empty map',
				expected: false,
				node: createMockMapInit([]),
			},
			{
				desc: 'returns false for single pair',
				expected: false,
				node: createMockMapInit(singlePair),
			},
			{
				desc: 'returns true for 2+ pairs',
				expected: true,
				node: createMockMapInit(twoPairs),
			},
			{
				desc: 'handles null/undefined pairs gracefully',
				expected: false,
				node: {
					[NODE_CLASS_KEY]:
						'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: null as unknown as ApexNode[],
				} as Readonly<ApexMapInitNode>,
			},
			{
				desc: 'handles non-array pairs gracefully',
				expected: false,
				node: {
					[NODE_CLASS_KEY]:
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
		// Use different names to avoid shadowing imported constants
		const LOCAL_LIST_LITERAL_CLASS =
			'apex.jorje.data.ast.NewObject$NewListLiteral';
		const LOCAL_SET_LITERAL_CLASS =
			'apex.jorje.data.ast.NewObject$NewSetLiteral';
		const LOCAL_MAP_LITERAL_CLASS =
			'apex.jorje.data.ast.NewObject$NewMapLiteral';
		const NEW_EXPR_CLASS = 'apex.jorje.data.ast.Expr$NewExpr';

		it.concurrent.each([
			{
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: {
							'@class': LOCAL_LIST_LITERAL_CLASS,
						},
					},
				},
				desc: 'identifies List literal assignment',
				expected: true,
			},
			{
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: {
							'@class': LOCAL_SET_LITERAL_CLASS,
						},
					},
				},
				desc: 'identifies Set literal assignment',
				expected: true,
			},
			{
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: {
							'@class': LOCAL_MAP_LITERAL_CLASS,
						},
					},
				},
				desc: 'identifies Map literal assignment',
				expected: true,
			},
			{
				assignment: 'not an object',
				desc: 'rejects non-object assignment',
				expected: false,
			},
			{
				assignment: {},
				desc: 'rejects assignment without value property',
				expected: false,
			},
			{
				assignment: {
					value: null,
				},
				desc: 'rejects assignment with null value',
				expected: false,
			},
			{
				assignment: {
					value: {
						'@class': 'apex.jorje.data.ast.LiteralExpr',
					},
				},
				desc: 'rejects assignment with non-NewExpr value',
				expected: false,
			},
			{
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: null,
					},
				},
				desc: 'rejects assignment with null creator',
				expected: false,
			},
			{
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: {
							'@class': 'apex.jorje.data.ast.Identifier',
						},
					},
				},
				desc: 'rejects assignment with non-collection creator',
				expected: false,
			},
			{
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						// Missing creator property
					},
				},
				desc: 'rejects assignment with missing creator property',
				expected: false,
			},
			{
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: 'not an object',
					},
				},
				desc: 'rejects assignment with non-object creator',
				expected: false,
			},
			{
				assignment: {
					value: {
						'@class': NEW_EXPR_CLASS,
						creator: {},
					},
				},
				desc: 'rejects assignment with creator without @class property',
				expected: false,
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
	});
});
