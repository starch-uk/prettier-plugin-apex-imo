/**
 * @file ParserOptions mock factories for testing.
 * Provides common option configurations for tests.
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Mock factories for testing don't require strict readonly parameters */
import type { ParserOptions } from 'prettier';

/**
 * Creates default mock parser options for testing.
 * @param overrides - Optional partial options object to override defaults.
 * @returns Mock parser options with default values and any overrides applied.
 * @example
 * ```typescript
 * const options = createMockOptions();
 * const customOptions = createMockOptions({ printWidth: 100 });
 * ```
 */
function createMockOptions(
	overrides?: Partial<ParserOptions>,
): Readonly<ParserOptions> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock factory for testing
	return {
		printWidth: 80,
		tabWidth: 2,
		useTabs: false,
		...overrides,
	} as Readonly<ParserOptions>;
}

/**
 * Creates mock options with tabs enabled for testing.
 * @param overrides - Optional partial options object to override defaults.
 * @returns Mock parser options with useTabs: true and any overrides applied.
 */
function createMockOptionsWithTabs(
	overrides?: Partial<ParserOptions>,
): Readonly<ParserOptions> {
	return createMockOptions({ useTabs: true, ...overrides });
}

/**
 * Creates mock options with custom print width for testing.
 * @param printWidth - The print width value to use.
 * @param overrides - Optional partial options object to override defaults.
 * @returns Mock parser options with the specified print width and any overrides applied.
 */
function createMockOptionsWithPrintWidth(
	printWidth: number,
	overrides?: Partial<ParserOptions>,
): Readonly<ParserOptions> {
	return createMockOptions({ printWidth, ...overrides });
}

/**
 * Creates mock options with custom tab width for testing.
 * @param tabWidth - The tab width value to use.
 * @param overrides - Optional partial options object to override defaults.
 * @returns Mock parser options with the specified tab width and any overrides applied.
 */
function createMockOptionsWithTabWidth(
	tabWidth: number,
	overrides?: Partial<ParserOptions>,
): Readonly<ParserOptions> {
	return createMockOptions({ tabWidth, ...overrides });
}

// Export all functions in a single export declaration
export {
	createMockOptions,
	createMockOptionsWithPrintWidth,
	createMockOptionsWithTabWidth,
	createMockOptionsWithTabs,
};
