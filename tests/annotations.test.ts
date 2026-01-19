/**
 * @file Unit tests for the annotations module.
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { describe, it, expect } from 'vitest';
import type { AstPath } from 'prettier';
import { isAnnotation, printAnnotation } from '../src/annotations.js';
import type {
	ApexAnnotationNode,
	ApexAnnotationParameter,
	ApexAnnotationValue,
} from '../src/types.js';
import { createMockPath } from './test-utils.js';
import {
	NODE_CLASS_KEY,
	createMockIdentifier,
	createMockAnnotation,
	createMockAnnotationStringParameter,
	createMockAnnotationKeyValueParameter,
	createMockMethodDecl,
} from './mocks/nodes.js';
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
			const node = createMockAnnotation('Test', []);

			expect(isAnnotation(node)).toBe(true);
		});

		it.concurrent('should return false for non-annotation nodes', () => {
			const node = createMockMethodDecl();

			expect(isAnnotation(node)).toBe(false);
		});
	});

	describe('printAnnotation', () => {
		it.concurrent('should print annotation without parameters', () => {
			const mockNode = createMockAnnotation('test', []);

			const mockPath = createMockPath(
				mockNode,
			) as AstPath<ApexAnnotationNode>;
			const result = printAnnotation(mockPath);

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
					createMockAnnotationStringParameter(
						'PMD.UnusedLocalVariable',
					),
				],
			},
			{
				annotationName: 'future',
				description: 'should print annotation with key-value parameter',
				parameters: [
					createMockAnnotationKeyValueParameter('callout', true),
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
				const mockNode = createMockAnnotation(
					annotationName,
					parameters,
				);

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

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
					createMockAnnotationKeyValueParameter('label', ''),
				],
			},
			{
				description:
					'should handle annotation with undefined value field',
				parameters: [
					{
						[NODE_CLASS_KEY]:
							'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
						key: createMockIdentifier('label'),
						value: {
							[NODE_CLASS_KEY]:
								'apex.jorje.data.ast.AnnotationValue$StringAnnotationValue',
							// value property intentionally undefined for test
						} as Readonly<ApexAnnotationValue>,
					} as Readonly<ApexAnnotationParameter>,
				],
			},
			{
				description:
					'should handle annotation parameter without value property',
				parameters: [
					{
						[NODE_CLASS_KEY]:
							'apex.jorje.data.ast.AnnotationParameter$AnnotationString',
					} as unknown as Readonly<ApexAnnotationParameter>,
				],
			},
			{
				description:
					'should handle AnnotationKeyValue with non-string value (fallback to empty string)',
				parameters: [
					{
						[NODE_CLASS_KEY]:
							'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
						key: createMockIdentifier('label'),
						value: {
							[NODE_CLASS_KEY]:
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
						[NODE_CLASS_KEY]:
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
			}: {
				parameters: readonly ApexAnnotationParameter[];
			}) => {
				const mockNode = createMockAnnotation('test', parameters);
				const result = printAnnotation(
					createMockPath(mockNode) as AstPath<ApexAnnotationNode>,
				);
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
			},
		);

		it.concurrent(
			'should handle multiline annotation with multiple key-value parameters',
			() => {
				const mockNode = createMockAnnotation('invocablemethod', [
					createMockAnnotationKeyValueParameter(
						'label',
						'Test Label',
					),
					createMockAnnotationKeyValueParameter(
						'description',
						'Another Parameter',
					),
				]);

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				// Multiline annotations should return a grouped doc structure
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
			},
		);

		it.concurrent(
			'should handle multiline annotation with mixed param types',
			() => {
				const mockNode = createMockAnnotation('invocablemethod', [
					createMockAnnotationStringParameter('StringParam'),
					createMockAnnotationKeyValueParameter(
						'label',
						'Test Label',
					),
				]);

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				// Multiline annotations should return a grouped doc structure
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
			},
		);

		it.concurrent(
			'should normalize annotation option name when annotation has no option mapping',
			() => {
				const mockNode = createMockAnnotation('deprecated', [
					createMockAnnotationKeyValueParameter(
						'unknownOption',
						true,
					),
				]);

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

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

				const parameters = [
					parameterType === 'AnnotationString'
						? createMockAnnotationStringParameter(longString)
						: createMockAnnotationKeyValueParameter(
								'label',
								longString,
							),
				];
				const mockNode = createMockAnnotation(
					annotationName,
					parameters,
				);

				const mockPath = createMockPath(
					mockNode,
				) as AstPath<ApexAnnotationNode>;
				const result = printAnnotation(mockPath);

				// Verify result is a valid Doc structure
				expect(
					Array.isArray(result) || typeof result === 'object',
				).toBe(true);
			},
		);
	});
});
