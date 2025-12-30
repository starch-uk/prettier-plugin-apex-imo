import type { Plugin } from 'prettier';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - prettier-plugin-apex types may not be fully typed
import * as apexPlugin from 'prettier-plugin-apex';
import { createWrappedPrinter } from './printer.js';
import type { ApexNode } from './types.js';

// Get the original apex printer
const originalPrinter = apexPlugin.printers?.['apex'];

if (!originalPrinter) {
	throw new Error(
		'prettier-plugin-apex-imo requires prettier-plugin-apex to be installed. ' +
			'The apex printer was not found.',
	);
}

// Create our wrapped printer
const wrappedPrinter = createWrappedPrinter(originalPrinter);

/**
 * prettier-plugin-apex-imo
 *
 * Extends prettier-plugin-apex to enforce multiline formatting for
 * Lists and Maps with 2+ entries.
 */
const plugin: Plugin<ApexNode> = {
	// Re-export languages from apex plugin
	languages: apexPlugin.languages,

	// Re-export parsers from apex plugin
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore - apex plugin parsers have different type signature
	parsers: apexPlugin.parsers,

	// Provide our wrapped printer
	printers: {
		apex: wrappedPrinter,
	},

	// Re-export options from apex plugin (if any)
	options: apexPlugin.options,

	// Re-export defaultOptions from apex plugin (if any)
	defaultOptions: apexPlugin.defaultOptions,
};

export default plugin;

// Named exports for ESM compatibility
export const languages = plugin.languages;
export const parsers = plugin.parsers;
export const printers = plugin.printers;
export const options = plugin.options;
export const defaultOptions = plugin.defaultOptions;
