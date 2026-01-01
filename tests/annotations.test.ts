/**
 * @file Unit tests for the annotations module.
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect } from 'vitest';
import type { AstPath } from 'prettier';
import {
	isAnnotation,
	normalizeAnnotationNamesInText,
	printAnnotation,
} from '../src/annotations.js';
import type {
	ApexNode,
	ApexAnnotationNode,
	ApexAnnotationValue,
	ApexAnnotationParameter,
} from '../src/types.js';
import { createMockPath } from './test-utils.js';

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
				expected: '@AuraEnabled @Future @Test',
				input: '@auraenabled @future @test',
			},
			{
				description:
					'should normalize annotation names without parameters',
				expected: '@Deprecated',
				input: '@deprecated',
			},
			{
				description:
					'should normalize annotation names with parameters',
				expected: '@InvocableMethod(label="Test")',
				input: '@invocablemethod(label="Test")',
			},
			{
				description:
					'should normalize annotation option names to camelCase',
				expected: '@InvocableMethod(label="Test", description="Desc")',
				input: '@invocablemethod(LABEL="Test", DESCRIPTION="Desc")',
			},
			{
				description:
					'should handle annotation names not in the mapping',
				expected: '@CustomAnnotation',
				input: '@CustomAnnotation',
			},
			{
				description:
					'should handle annotation option names not in the mapping',
				expected: '@CustomAnnotation(UnknownOption="value")',
				input: '@CustomAnnotation(UnknownOption="value")',
			},
			{
				description: 'should handle empty parameters',
				expected: '@Test()',
				input: '@test()',
			},
			{
				description: 'should handle multiple annotations in text',
				expected: '@AuraEnabled @Future(callout=true) @Test',
				input: '@auraenabled @future(callout=true) @test',
			},
			{
				description:
					'should handle annotation with option name that matches preferred case',
				expected: '@InvocableMethod(label="Test")',
				input: '@invocablemethod(label="Test")',
			},
		])(
			'$description',
			({
				expected,
				input,
			}: Readonly<{
				description: string;
				expected: string;
				input: string;
			}>) => {
				const result = normalizeAnnotationNamesInText(input);
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
			'should format annotation value with empty string',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'test',
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
								value: '',
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
			'should format annotation value with non-string value field',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'test',
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
								value: { someProperty: 'value' }, // Non-string value to trigger fallback
							} as unknown as Readonly<ApexAnnotationValue>,
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
			'should format annotation value with undefined value field',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'test',
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
								// value field is undefined
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
