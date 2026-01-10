/**
 * @file Unit tests for the apexdoc module.
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, it, expect } from 'vitest';
import type { ParserOptions } from 'prettier';
import { EMPTY_CODE_TAG } from '../src/apexdoc.js';
import { loadFixture } from './test-utils.js';

describe('apexdoc', () => {
	describe('EMPTY_CODE_TAG', () => {
		it.concurrent('should be {@code}', () => {
			expect(EMPTY_CODE_TAG).toBe('{@code}');
		});
	});

});
