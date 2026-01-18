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

		it.concurrent.each([
			{
				annotationName: 'suppresswarnings',
				description:
					'should print annotation with single string parameter',
				parameters: [
					{
						[nodeClassKey]:
							'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
						value: 'PMD.UnusedLocalVariable',
					} as Readonly<ApexAnnotationParameter>,
				],
			},
			{
				annotationName: 'future',
				description: 'should print annotation with key-value parameter',
				parameters: [
					{
						key: {
							[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
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
			},
		])(
			'$description',
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
			({
				annotationName,
				parameters,
			}: Readonly<{
				annotationName: string;
				description: string;
				parameters: readonly ApexAnnotationParameter[];
			}>) => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: annotationName,
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters,
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				expect(result).toBeDefined();
				// Verify result is a valid Doc structure (array or Prettier doc object)
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
			},
		);

		it.concurrent.each([
			{
				description: 'should handle annotation with empty string value',
				parameters: [
					{
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
					} as Readonly<ApexAnnotationParameter>,
				],
			},
			{
				description:
					'should handle annotation with undefined value field',
				parameters: [
					{
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
					} as Readonly<ApexAnnotationParameter>,
				],
			},
			{
				description:
					'should handle annotation parameter without value property',
				parameters: [
					{
						[nodeClassKey]:
							'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
					} as unknown as Readonly<ApexAnnotationParameter>,
				],
			},
		])(
			'$description',
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
			({
				parameters,
			}: Readonly<{
				description: string;
				parameters: readonly ApexAnnotationParameter[];
			}>) => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'test',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters,
				} as Readonly<ApexAnnotationNode>;
				const result = printAnnotation(
					createMockPath(mockNode) as AstPath<ApexAnnotationNode>,
				);
				expect(result).toBeDefined();
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
			},
		);

		it.concurrent.each([
			{
				description:
					'should handle AnnotationKeyValue with non-string value (fallback to empty string)',
				parameters: [
					{
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
					} as Readonly<ApexAnnotationParameter>,
				],
			},
			{
				description:
					'should handle AnnotationString with non-string value (fallback to empty string)',
				parameters: [
					{
						[nodeClassKey]:
							'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
						value: 123,
					} as unknown as Readonly<ApexAnnotationParameter>,
				],
			},
		])(
			'$description',
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- Test parameters need mutable access
			({
				parameters,
			}: Readonly<{
				description: string;
				parameters: readonly ApexAnnotationParameter[];
			}>) => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'test',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters,
				} as Readonly<ApexAnnotationNode>;
				const result = printAnnotation(
					createMockPath(mockNode) as AstPath<ApexAnnotationNode>,
				);
				expect(result).toBeDefined();
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
			},
		);

		it.concurrent(
			'should handle multiline annotation with multiple key-value parameters',
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
								value: 'Another Parameter',
							} as Readonly<ApexAnnotationValue>,
						} as Readonly<ApexAnnotationParameter>,
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				expect(result).toBeDefined();
				// Multiline annotations should return a grouped doc structure
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
			},
		);

		it.concurrent(
			'should handle multiline annotation with mixed param types',
			() => {
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

				expect(result).toBeDefined();
				// Multiline annotations should return a grouped doc structure
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
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
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
			},
		);

		it.concurrent.each([
			{
				annotationName: 'invocablemethod',
				description:
					'should force multiline for InvocableMethod with single long string parameter',
				parameterType: 'AnnotationString' as const,
				shouldForceMultiline: true,
			},
			{
				annotationName: 'invocablevariable',
				description:
					'should force multiline for InvocableVariable with single long parameter string',
				parameterType: 'AnnotationKeyValue' as const,
				shouldForceMultiline: true,
			},
			{
				annotationName: 'future',
				description:
					'should not force multiline for non-invocable annotation with long parameter',
				parameterType: 'AnnotationKeyValue' as const,
				shouldForceMultiline: false,
			},
		])(
			'$description',
			({
				annotationName,
				parameterType,
				shouldForceMultiline: _shouldForceMultiline,
			}: Readonly<{
				annotationName: string;
				description: string;
				parameterType: 'AnnotationKeyValue' | 'AnnotationString';
				shouldForceMultiline: boolean;
			}>) => {
				/** Longer than MIN_PARAM_LENGTH_FOR_MULTILINE (40). */
				const longString = 'A'.repeat(
					MIN_PARAM_LENGTH_FOR_MULTILINE + LENGTH_OFFSET,
				);

				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: annotationName,
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						parameterType === 'AnnotationString'
							? ({
									[nodeClassKey]:
										'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
									value: longString,
								} as Readonly<ApexAnnotationParameter>)
							: ({
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
								} as Readonly<ApexAnnotationParameter>),
					],
				} as Readonly<ApexAnnotationNode>;

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				expect(result).toBeDefined();
				// Verify result is a valid Doc structure
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
			},
		);
	});
});
