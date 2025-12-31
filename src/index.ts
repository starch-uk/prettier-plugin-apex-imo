/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import type { Plugin, ParserOptions } from 'prettier';
import * as apexPlugin from 'prettier-plugin-apex';
import { createWrappedPrinter } from './printer.js';
import type { ApexNode } from './types.js';
import {
	findApexDocCodeBlocks,
	formatCodeBlock,
	applyCommentIndentation,
	normalizeAnnotationName,
	normalizeAnnotationOptionName,
} from './utils.js';

const apexPrinter = (apexPlugin as { printers?: { apex?: unknown } }).printers
	?.apex;
if (
	apexPrinter === null ||
	apexPrinter === undefined ||
	typeof apexPrinter !== 'object' ||
	!('print' in apexPrinter) ||
	typeof (apexPrinter as { print?: unknown }).print !== 'function'
) {
	throw new Error(
		'prettier-plugin-apex-imo requires prettier-plugin-apex to be installed. The apex printer was not found.',
	);
}
const wrappedPrinter = createWrappedPrinter(
	apexPrinter as Parameters<typeof createWrappedPrinter>[0],
);

function normalizeAnnotationNamesInText(text: string): string {
	return text
		.replace(
			/@([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g,
			(_match, name: string, params: string) => {
				const normalizedName = normalizeAnnotationName(name);
				const normalizedParams = params.replace(
					/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g,
					(m, opt: string) => {
						const normalized = normalizeAnnotationOptionName(
							normalizedName,
							opt,
						);
						return normalized !== opt ? `${normalized}=` : m;
					},
				);
				return `@${normalizedName}(${normalizedParams})`;
			},
		)
		.replace(
			/@([a-zA-Z_][a-zA-Z0-9_]*)(?![a-zA-Z0-9_(])/g,
			(_match, name: string) => `@${normalizeAnnotationName(name)}`,
		);
}

function createPreprocess(pluginInstance: Readonly<Plugin<ApexNode>>) {
	return async function preprocess(
		text: Readonly<string>,
		options: Readonly<ParserOptions<ApexNode>>,
	): Promise<string> {
		if (options.parser !== 'apex' && options.parser !== 'apex-anonymous')
			return text;
		const codeBlocks = findApexDocCodeBlocks(text);
		if (codeBlocks.length === 0) return text;
		let processedText = text;
		for (let i = codeBlocks.length - 1; i >= 0; i--) {
			const block = codeBlocks[i];
			if (!block.code || block.code.trim() === '') {
				processedText =
					processedText.substring(0, block.startPos) +
					'{@code}' +
					processedText.substring(block.endPos);
				continue;
			}
			const formattedCode = await formatCodeBlock(
				block.code,
				options,
				pluginInstance,
			);
			if (
				!formattedCode ||
				formattedCode.trim() === '' ||
				formattedCode.startsWith('__FORMAT_FAILED__')
			)
				continue;
			if (
				formattedCode === block.code &&
				processedText
					.substring(block.startPos, block.endPos)
					.includes('\n')
			)
				continue;
			const indentedCode = applyCommentIndentation(
				formattedCode,
				block,
				options,
			);
			const { tabWidth, useTabs } = options;
			const closingIndent =
				useTabs === true
					? '\t'.repeat(Math.floor(block.commentIndent / tabWidth))
					: ' '.repeat(block.commentIndent);
			const newBlock = `{@code\n${indentedCode}\n${closingIndent} * }`;
			processedText =
				processedText.substring(0, block.startPos) +
				newBlock +
				processedText.substring(block.endPos);
		}
		return processedText;
	};
}

function wrapParsers(
	parsers: Readonly<Plugin<ApexNode>['parsers']>,
	pluginInstance: Readonly<Plugin<ApexNode>>,
): Plugin<ApexNode>['parsers'] {
	if (!parsers) return parsers;
	const ourPreprocess = createPreprocess(pluginInstance);
	const wrappedParsers: Record<string, unknown> = {};
	for (const parserName in parsers) {
		if (!Object.prototype.hasOwnProperty.call(parsers, parserName))
			continue;
		const originalParser = parsers[parserName];
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions
		if (originalParser?.parse) {
			const originalPreprocess = originalParser.preprocess;
			wrappedParsers[parserName] = {
				...originalParser,
				parse: async (
					text: Readonly<string>,
					options: Readonly<ParserOptions<ApexNode>>,
				): Promise<ApexNode> => {
					return await originalParser.parse(
						normalizeAnnotationNamesInText(text),
						options,
					);
				},
				preprocess: async (
					text: Readonly<string>,
					options: Readonly<ParserOptions<ApexNode>>,
				): Promise<string> => {
					const preprocessed = originalPreprocess
						? await (originalPreprocess(text, options) instanceof
							Promise
								? originalPreprocess(text, options)
								: Promise.resolve(
										originalPreprocess(text, options),
									))
						: text;
					return await ourPreprocess(
						normalizeAnnotationNamesInText(preprocessed),
						options,
					);
				},
			};
		}
	}
	return wrappedParsers as Plugin<ApexNode>['parsers'];
}

const apexPluginTyped = apexPlugin as unknown as Plugin<ApexNode>;
const plugin: Plugin<ApexNode> = {
	languages: apexPluginTyped.languages,
	parsers: apexPluginTyped.parsers,
	printers: { apex: wrappedPrinter },
	options: apexPluginTyped.options,
	defaultOptions: apexPluginTyped.defaultOptions,
};
plugin.parsers = wrapParsers(apexPluginTyped.parsers, plugin);
export default plugin;
export const { languages, parsers, printers, options, defaultOptions } = plugin;
