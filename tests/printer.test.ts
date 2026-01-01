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
} from '../src/collections.js';
import type {
	ApexNode,
	ApexListInitNode,
	ApexMapInitNode,
} from '../src/types.js';

const nodeClassKey = '@class';

describe('utils', () => {
	describe('isListInit', () => {
		it.each([
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
		it.each([
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
		it.each([
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

		it.each([
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
});
