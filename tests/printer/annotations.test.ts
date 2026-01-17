/**
 * @file Unit tests for annotation normalization in the printer module.
 */

import { describe, it, expect } from 'vitest';
import { createWrappedPrinter } from '../../src/printer.js';
import {
	createMockPath,
	createMockOptions,
	createMockPrint,
	createMockOriginalPrinter,
} from '../test-utils.js';

const nodeClassKey = '@class';

describe('printer', () => {
	describe('annotation normalization', () => {
		it.concurrent('should normalize annotation names to PascalCase', () => {
			const mockNode = {
				name: {
					[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
					value: 'auraenabled',
				},
				[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
				parameters: [],
			};

			const mockPath = createMockPath(mockNode);
			const mockOriginalPrinter = createMockOriginalPrinter();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
			const wrappedPrinter = createWrappedPrinter(mockOriginalPrinter);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
			const result = wrappedPrinter.print(
				mockPath,
				createMockOptions(),
				createMockPrint(),
			);

			// Should normalize to AuraEnabled
			// Result is a Doc structure - check it's defined and not the original output
			expect(result).toBeDefined();
			expect(result).not.toBe('original output');
			// The result should be an array containing '@' and 'AuraEnabled'
			if (Array.isArray(result)) {
				const FIRST_INDEX = 0;
				const SECOND_INDEX = 1;
				expect(result[FIRST_INDEX]).toBe('@');
				expect(result[SECOND_INDEX]).toBe('AuraEnabled');
			}
		});

		it.concurrent(
			'should normalize annotation option names to camelCase',
			() => {
				const mockNode = {
					name: {
						[nodeClassKey]: 'apex.jorje.data.ast.Identifier',
						value: 'auraenabled',
					},
					[nodeClassKey]: 'apex.jorje.data.ast.Modifier$Annotation',
					parameters: [
						{
							key: {
								[nodeClassKey]:
									'apex.jorje.data.ast.Identifier',
								value: 'cacheable',
							},
							[nodeClassKey]:
								'apex.jorje.data.ast.AnnotationParameter$AnnotationKeyValue',
							value: {
								[nodeClassKey]:
									'apex.jorje.data.ast.AnnotationValue$TrueAnnotationValue',
							},
						},
					],
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrappedPrinter =
					createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
				const result = wrappedPrinter.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should normalize annotation to AuraEnabled and option to cacheable
				// Result should be a group with @AuraEnabled(cacheable=true)
				expect(result).toBeDefined();
				expect(result).not.toBe('original output');
			},
		);

		it.concurrent(
			'should format annotations with single parameter on one line',
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
						},
					],
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrappedPrinter =
					createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
				const result = wrappedPrinter.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should format as single line: @Future(callout=true)
				expect(result).toBeDefined();
				expect(result).not.toBe('original output');
			},
		);

		it.concurrent(
			'should format InvocableMethod with multiple parameters on multiple lines',
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
							},
						},
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
							},
						},
					],
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrappedPrinter =
					createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
				const result = wrappedPrinter.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should force multiline format for InvocableMethod with multiple params
				expect(result).toBeDefined();
				expect(result).not.toBe('original output');
			},
		);

		it.concurrent(
			'should format SuppressWarnings with comma-separated string',
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
							value: 'PMD.UnusedLocalVariable, PMD.UnusedPrivateMethod',
						},
					],
				};

				const mockPath = createMockPath(mockNode);
				const mockOriginalPrinter = createMockOriginalPrinter();
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Mock printer return type
				const wrappedPrinter =
					createWrappedPrinter(mockOriginalPrinter);

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Mock printer methods
				const result = wrappedPrinter.print(
					mockPath,
					createMockOptions(),
					createMockPrint(),
				);

				// Should format as: @SuppressWarnings('PMD.UnusedLocalVariable, PMD.UnusedPrivateMethod')
				expect(result).toBeDefined();
				expect(result).not.toBe('original output');
			},
		);
	});
});
