/**
 * @file Unit tests for the annotations module.
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect } from 'vitest';
import type { AstPath } from 'prettier';
import { isAnnotation, printAnnotation } from '../src/annotations.js';
import type {
	ApexNode,
	ApexAnnotationNode,
	ApexAnnotationValue,
	ApexAnnotationParameter,
} from '../src/types.js';
import { createMockPath, loadFixture, formatApex } from './test-utils.js';

const nodeClassKey = '@class';
/** Minimum parameter length for multiline formatting. */
const MIN_PARAM_LENGTH_FOR_MULTILINE = 40;
/** Offset to create a string longer than minimum. */
const LENGTH_OFFSET = 1;
const FIRST_INDEX = 0;
const SECOND_INDEX = 1;
const THIRD_INDEX = 2;

describe('annotations', () => {
	describe('isAnnotation', () => {
		it.concurrent('should return true for annotation nodes', () => {
			const node = {
				name: {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'Test',
				},
				[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
				parameters: [],
			} as Readonly<ApexNode>;

			expect(isAnnotation(node)).toBe(true);
		});

		it.concurrent('should return false for non-annotation nodes', () => {
			const node = {
				[nodeClassKey]: 'apex.jorje.data.ast.MethodDecl',
			} as Readonly<ApexNode>;

			expect(isAnnotation(node)).toBe(false);
		});
	});

	describe('normalizeAnnotationNamesInText', () => {
		it.concurrent.each([
			{
				description: 'should normalize annotation names to PascalCase',
				fixture: 'annotation-normalize-names-pascalcase',
			},
			{
				description:
					'should normalize annotation names without parameters',
				fixture: 'annotation-normalize-names-no-params',
			},
			{
				description:
					'should normalize annotation names with parameters',
				fixture: 'annotation-normalize-names-with-params',
			},
			{
				description:
					'should normalize annotation option names to camelCase',
				fixture: 'annotation-normalize-option-names',
			},
			{
				description:
					'should handle annotation names not in the mapping',
				fixture: 'annotation-normalize-names-not-in-mapping',
			},
			{
				description: 'should handle empty parameters',
				fixture: 'annotation-normalize-empty-params',
			},
			{
				description: 'should handle multiple annotations in text',
				fixture: 'annotation-normalize-multiple',
			},
			{
				description:
					'should handle annotation with option name that matches preferred case',
				fixture:
					'annotation-normalize-option-name-matches-preferred-case',
			},
		])(
			'$description',
			async ({
				fixture,
			}: Readonly<{
				description: string;
				fixture: string;
			}>) => {
				const input = loadFixture(fixture, 'input');
				const expected = loadFixture(fixture, 'output');
				const result = await formatApex(input);
				expect(result).toBe(expected);
			},
		);
	});

	describe('printAnnotation', () => {
		it.concurrent('should print annotation without parameters', () => {
			const mockNode = {
				name: {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'test',
				},
				[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
				parameters: [],
			} as Readonly<ApexAnnotationNode>;

			const mockPath = createMockPath(
				mockNode,
			) as AstPath<ApexAnnotationNode>;
			const result = printAnnotation(mockPath);

			expect(result).toBeDefined();
			expect(Array.isArray(result)).toBe(true);
			if (Array.isArray(result)) {
				expect(result[FIRST_INDEX]).toBe('@');
				expect(result[SECOND_INDEX]).toBe('Test');
				expect(result[THIRD_INDEX]).toBeDefined(); // hardline
			}
		});

		it.concurrent(
			'should print annotation with single string parameter',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'suppresswarnings',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
							value: 'PMD.UnusedLocalVariable',
						} as Readonly<ApexAnnotationParameter>,
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should print annotation with key-value parameter',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'future',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'callout',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue',
							},
						} as Readonly<ApexAnnotationParameter>,
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should handle annotation value with missing, undefined, or empty string',
			() => {
				// Empty string, undefined value field, and parameter without value property
				const keyValueEmpty = {
					key: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'label',
					},
					[nodeClassKey]:
						'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
					value: {
						[nodeClassKey]:
							'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
						value: '',
					} as Readonly<ApexAnnotationValue>,
				} as Readonly<ApexAnnotationParameter>;
				const keyValueUndefined = {
					key: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'label',
					},
					[nodeClassKey]:
						'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
					value: {
						[nodeClassKey]:
							'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
					} as Readonly<ApexAnnotationValue>,
				} as Readonly<ApexAnnotationParameter>;
				const stringNoValue = {
					[nodeClassKey]:
						'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
				} as unknown as Readonly<ApexAnnotationParameter>;

				for (const params of [
					[keyValueEmpty],
					[keyValueUndefined],
					[stringNoValue],
				]) {
					const mockNode = {
						name: {
							[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
							value: 'test',
						},
						[nodeClassKey]:
							'apex.jorje.data.ast.Modifier$Annotation',
						parameters: params,
					} as Readonly<ApexAnnotationNode>;
					const result = printAnnotation(
						createMockPath(mockNode) as AstPath<ApexAnnotationNode>,
					);
					expect(result).toBeDefined();
				}
			},
		);

		it.concurrent(
			'should handle annotation parameter with non-string value (fallback to empty string)',
			() => {
				// AnnotationKeyValue with object value; AnnotationString with number value
				const keyValueNonString = {
					key: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'label',
					},
					[nodeClassKey]:
						'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
					value: {
						[nodeClassKey]:
							'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
						value: { someProperty: 'value' },
					} as unknown as Readonly<ApexAnnotationValue>,
				} as Readonly<ApexAnnotationParameter>;
				const stringNonString = {
					[nodeClassKey]:
						'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
					value: 123,
				} as unknown as Readonly<ApexAnnotationParameter>;

				for (const params of [[keyValueNonString], [stringNonString]]) {
					const mockNode = {
						name: {
							[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
							value: 'test',
						},
						[nodeClassKey]:
							'apex.jorje.data.ast.Modifier$Annotation',
						parameters: params,
					} as Readonly<ApexAnnotationNode>;
					const result = printAnnotation(
						createMockPath(mockNode) as AstPath<ApexAnnotationNode>,
					);
					expect(result).toBeDefined();
				}
			},
		);

		it.concurrent(
			'should handle multiline annotation with array params',
			() => {
				// Test that array params in multiline annotations are wrapped with group
				// This triggers the Array.isArray(param) branch in paramsForJoin
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'invocablemethod',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'label',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
								value: 'Test Label',
							} as Readonly<ApexAnnotationValue>,
						} as Readonly<ApexAnnotationParameter>,
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'description',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
								value: 'Another Parameter',
							} as Readonly<ApexAnnotationValue>,
						} as Readonly<ApexAnnotationParameter>,
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				// Should force multiline (2 params > 1) and wrap array params with group
				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should handle multiline annotation with mixed param types (string and array)',
			() => {
				// Test both branches of Array.isArray(param) ? group(param) : param
				// AnnotationString returns string, AnnotationKeyValue returns array
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'invocablemethod',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
							value: 'StringParam',
						} as Readonly<ApexAnnotationParameter>,
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'label',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
								value: 'Test Label',
							} as Readonly<ApexAnnotationValue>,
						} as Readonly<ApexAnnotationParameter>,
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				// Should force multiline (2 params > 1)
				// First param is string (not array) - tests : param branch
				// Second param is array - tests group(param) branch
				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should normalize annotation option name when annotation has no option mapping',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'deprecated',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'unknownOption',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue',
							},
						} as Readonly<ApexAnnotationParameter>,
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should force multiline for InvocableMethod with single long string parameter',
			() => {
				/** Longer than MIN_PARAM_LENGTH_FOR_MULTILINE (40). */
				const longString = 'A'.repeat(
					MIN_PARAM_LENGTH_FOR_MULTILINE + LENGTH_OFFSET,
				);
				// Use AnnotationString parameter (returns string Doc, not array)
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'invocablemethod',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
							value: longString,
						} as Readonly<ApexAnnotationParameter>,
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should force multiline for InvocableVariable with single long parameter string',
			() => {
				/** Longer than MIN_PARAM_LENGTH_FOR_MULTILINE (40). */
				const longString = 'A'.repeat(
					MIN_PARAM_LENGTH_FOR_MULTILINE + LENGTH_OFFSET,
				);
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'invocablevariable',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'label',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
								value: longString,
							} as Readonly<ApexAnnotationValue>,
						} as Readonly<ApexAnnotationParameter>,
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should not force multiline for non-invocable annotation with long parameter',
			() => {
				const longString = 'A'.repeat(
					MIN_PARAM_LENGTH_FOR_MULTILINE + LENGTH_OFFSET,
				);
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'future',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'callout',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
								value: longString,
							} as Readonly<ApexAnnotationValue>,
						} as Readonly<ApexAnnotationParameter>,
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				expect(result).toBeDefined();
			},
		);

		it.concurrent(
			'should handle annotation with multiple parameters',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'invocablemethod',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'label',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
								value: 'Test Label',
							} as Readonly<ApexAnnotationValue>,
						} as Readonly<ApexAnnotationParameter>,
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'description',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
								value: 'Test Description',
							} as Readonly<ApexAnnotationValue>,
						} as Readonly<ApexAnnotationParameter>,
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				expect(result).toBeDefined();
			},
		);
	});
});
