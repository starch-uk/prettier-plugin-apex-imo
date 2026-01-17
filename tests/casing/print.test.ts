/**
 * @file Unit tests for print functions in the casing module.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types, @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect } from 'vitest';
import {
	createReservedWordNormalizingPrint,
	createTypeNormalizingPrint,
} from '../../src/casing.js';
import type { ApexNode, ApexIdentifier } from '../../src/types.js';
import { createMockPath, createMockPrint } from '../test-utils.js';

const nodeClassKey = '@class';

describe('casing', () => {
	describe('createTypeNormalizingPrint', () => {
		it.concurrent(
			'should return original print when shouldNormalizeType is false',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint =
					createTypeNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
				} as ApexNode;
				const path = createMockPath(node, 'body');

				const result = typeNormalizingPrint(path);

				expect(result).toBe('original output');
				expect(mockPrint).toHaveBeenCalledWith(path);
			},
		);

		it.concurrent(
			'should normalize single identifier with standard object type',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint =
					createTypeNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account',
				} as ApexIdentifier;
				const path = createMockPath(node, 'type');

				typeNormalizingPrint(path);

				// Should call print with modified node
				expect(mockPrint).toHaveBeenCalled();
			},
		);

		it.concurrent('should handle empty string in identifier value', () => {
			const mockPrint = createMockPrint();
			const typeNormalizingPrint = createTypeNormalizingPrint(mockPrint);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				value: '',
			} as ApexIdentifier;
			const path = createMockPath(node, 'type');

			const result = typeNormalizingPrint(path);

			expect(result).toBe('original output');
			expect(mockPrint).toHaveBeenCalledWith(path);
		});

		it.concurrent.each([
			{
				desc: 'two valid nodes and parent without value',
				expectResult: undefined as string | undefined,
				valueSpecs: ['account', 'contact'],
			},
			{
				desc: 'node with no value property',
				expectResult: undefined as string | undefined,
				valueSpecs: [undefined, 'account'],
			},
			{
				desc: 'node with empty string value',
				expectResult: undefined as string | undefined,
				valueSpecs: ['', 'account'],
			},
			{
				desc: 'values already normalized',
				expectResult: 'original output',
				valueSpecs: ['Account', 'Contact'],
			},
		])(
			'should handle names array with $desc',
			({
				valueSpecs,
				expectResult,
			}: {
				valueSpecs: (string | undefined)[];
				expectResult: string | undefined;
			}) => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				const names = valueSpecs.map(
					(v) =>
						(v === undefined
							? {
									[nodeClassKey]:
										'apex.jorje.data.ast.Identifier',
								}
							: {
									[nodeClassKey]:
										'apex.jorje.data.ast.Identifier',
									value: v,
								}) as ApexIdentifier,
				);
				const node = {
					names: names as unknown as readonly ApexIdentifier[],
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				} as ApexNode & { names?: readonly ApexIdentifier[] };
				const path = createMockPath(node, 'names');

				const result = typeNormalizingPrint(path);

				expect(mockPrint).toHaveBeenCalled();
				if (expectResult !== undefined) {
					expect(result).toBe(expectResult);
				}
			},
		);

		it.concurrent(
			'should handle node with names array where names is not an array',
			() => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				const node = {
					names: 'not an array',

					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				} as ApexNode & { names?: unknown };
				const path = createMockPath(node, 'names');

				const result = typeNormalizingPrint(path);

				// Should return original print when names is not an array
				expect(result).toBe('original output');
				expect(mockPrint).toHaveBeenCalledWith(path);
			},
		);

		it.concurrent(
			'should handle names array restoration with node missing value property',
			() => {
				const mockPrint = createMockPrint();
				// To test the else branch of the restoration condition, we need:
				// 1. originalValues[i] to be defined (so we enter the restoration loop)
				// 2. nameNode to be an object but NOT have 'value' property during restoration
				// We use a Proxy to return different values during try vs finally
				const nameNode1 = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'account', // Will be normalized, stored in originalValues[0]
				} as ApexIdentifier;
				const nameNode2Original = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'contact', // Will be normalized, stored in originalValues[1]
				} as ApexIdentifier;
				const nameNode2WithoutValue = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					// No value property - to test the else branch
				} as ApexNode;

				// Track access to the array to modify what's returned during restoration
				let accessCount = 0;
				const namesArray = [nameNode1, nameNode2Original];
				const proxiedArray = new Proxy(namesArray, {
					get(target, prop): unknown {
						if (prop === 'length') return target.length;
						if (typeof prop === 'string' && /^\d+$/.test(prop)) {
							const index = Number.parseInt(prop, 10);
							accessCount++;
							const SECOND_INDEX = 1;
							const MIN_ACCESS_COUNT_FOR_FINALLY = 2;
							// After the try block completes (accessCount > 2 means we're in finally),
							// return node without value property to test the else branch
							if (
								index === SECOND_INDEX &&
								accessCount > MIN_ACCESS_COUNT_FOR_FINALLY
							) {
								return nameNode2WithoutValue;
							}
							return target[index];
						}
						return (
							target as unknown as Record<
								string | symbol,
								unknown
							>
						)[prop];
					},
				});

				const node = {
					names: proxiedArray as unknown as readonly ApexIdentifier[],
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				} as ApexNode & { names?: readonly ApexIdentifier[] };
				const path = createMockPath(node, 'names');

				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);

				typeNormalizingPrint(path);

				// Should call print
				expect(mockPrint).toHaveBeenCalled();
			},
		);

		it.concurrent.each([
			{
				addValueUndefined: true,
				desc: 'non-string value property',
				names: [
					{
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 123,
					} as unknown as ApexIdentifier,
					{
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'account',
					} as ApexIdentifier,
				],
			},
			{
				addValueUndefined: false,
				desc: 'non-object primitive',
				names: [
					'string' as unknown as ApexIdentifier,
					{
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'account',
					} as ApexIdentifier,
				] as unknown as readonly ApexIdentifier[],
			},
		])(
			'should handle names array with invalid element ($desc)',
			({
				addValueUndefined,
				names,
			}: {
				addValueUndefined: boolean;
				names: readonly ApexIdentifier[];
			}) => {
				const mockPrint = createMockPrint();
				const typeNormalizingPrint = createTypeNormalizingPrint(
					mockPrint,
					true,
					'names',
				);
				const node = {
					names,
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					...(addValueUndefined && { value: undefined }),
				} as ApexNode & { names?: readonly ApexIdentifier[] };
				const path = createMockPath(node, 'names');

				typeNormalizingPrint(path);

				expect(mockPrint).toHaveBeenCalled();
			},
		);

		it.concurrent.each([
			{ keyDesc: 'undefined', useNullKey: false },
			{ keyDesc: 'null', useNullKey: true },
		])('should handle key being $keyDesc', ({ useNullKey }) => {
			const mockPrint = createMockPrint();
			const typeNormalizingPrint = createTypeNormalizingPrint(mockPrint);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
			} as ApexNode;
			const basePath = createMockPath(node, undefined);
			const path = useNullKey
				? (Object.assign({}, basePath, { key: null }) as ReturnType<
						typeof createMockPath
					>)
				: basePath;

			const result = typeNormalizingPrint(path);

			expect(result).toBe('original output');
			expect(mockPrint).toHaveBeenCalledWith(path);
		});

		it.concurrent('should handle forceTypeContext parameter', () => {
			const mockPrint = createMockPrint();
			const typeNormalizingPrint = createTypeNormalizingPrint(
				mockPrint,
				true,
			);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				value: 'account',
			} as ApexIdentifier;
			const path = createMockPath(node, 'someKey');

			typeNormalizingPrint(path);

			// Should normalize because forceTypeContext is true
			expect(mockPrint).toHaveBeenCalled();
		});

		it.concurrent('should handle parentKey parameter', () => {
			const mockPrint = createMockPrint();
			const typeNormalizingPrint = createTypeNormalizingPrint(
				mockPrint,
				false,
				'types',
			);
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
				value: 'account',
			} as ApexIdentifier;
			const path = createMockPath(node, 'someKey');

			typeNormalizingPrint(path);

			// Should normalize because parentKey is 'types'
			expect(mockPrint).toHaveBeenCalled();
		});
	});

	describe('createReservedWordNormalizingPrint', () => {
		it.concurrent(
			'should return original print when node is not an identifier',
			() => {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
				} as ApexNode;
				const path = createMockPath(node, 'body');

				const result = reservedWordNormalizingPrint(path);

				expect(result).toBe('original output');
				expect(mockPrint).toHaveBeenCalledWith(path);
			},
		);

		it.concurrent(
			'should normalize identifier that is a reserved word',
			() => {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'PUBLIC',
				} as ApexIdentifier;
				const path = createMockPath(node, 'modifiers');

				reservedWordNormalizingPrint(path);

				// Should call print with modified node (value normalized to 'public')
				expect(mockPrint).toHaveBeenCalled();
				expect((node as { value: string }).value).toBe('PUBLIC'); // Restored after printing if not in array
			},
		);

		it.concurrent(
			'should normalize identifier in array (modifiers array)',
			() => {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'STATIC',
				} as ApexIdentifier;

				/**
				 * Array index.
				 */
				const path = createMockPath(node, 0);

				reservedWordNormalizingPrint(path);

				// Should call print with modified node (value normalized to 'static')
				expect(mockPrint).toHaveBeenCalled();
				// For arrays, value should remain normalized (not restored)
				expect((node as { value: string }).value).toBe('static');
			},
		);

		it.concurrent(
			'should return original print when identifier is not a reserved word',
			() => {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const node = {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'MyVariable',
				} as ApexIdentifier;
				const path = createMockPath(node, 'name');

				const result = reservedWordNormalizingPrint(path);

				expect(result).toBe('original output');
				expect(mockPrint).toHaveBeenCalledWith(path);
			},
		);

		it.concurrent.each([
			{
				description: 'empty string in identifier value',
				key: 'modifiers',
				node: {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: '',
				} as ApexIdentifier,
			},
			{
				description: 'identifier with non-string value property',
				key: 'modifiers',
				node: {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 123,
				} as ApexNode,
			},
			{
				description: 'null node',
				key: 'modifiers',
				node: null as unknown as ApexNode,
			},
		])(
			'should handle $description',
			({
				node,
				key,
			}: Readonly<{
				description: string;
				key: number | string;
				node: ApexNode;
			}>) => {
				const mockPrint = createMockPrint();
				const reservedWordNormalizingPrint =
					createReservedWordNormalizingPrint(mockPrint);
				const path = createMockPath(node, key);

				const result = reservedWordNormalizingPrint(path);

				expect(result).toBe('original output');
				expect(mockPrint).toHaveBeenCalledWith(path);
			},
		);

		it.concurrent(
			'should normalize reserved words in print context (integration test)',
			() => {
				// Test integration: verify that reserved word normalization works
				// in the context of the print function. Only test a few examples
				// since normalization.test.ts already tests all reserved words.
				const testCases = [
					{ expected: 'public', input: 'PUBLIC' },
					{ expected: 'static', input: 'STATIC' },
					{ expected: 'class', input: 'Class' },
				];

				for (const testCase of testCases) {
					const mockPrint = createMockPrint();
					const reservedWordNormalizingPrint =
						createReservedWordNormalizingPrint(mockPrint);
					const node = {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: testCase.input,
					} as ApexIdentifier;
					// Use array index to test normalization without restoration
					const path = createMockPath(node, 0);

					reservedWordNormalizingPrint(path);

					// For array indices, value should remain normalized (not restored)
					expect((node as { value: string }).value).toBe(
						testCase.expected,
					);
					expect(mockPrint).toHaveBeenCalled();
				}
			},
		);
	});
});
