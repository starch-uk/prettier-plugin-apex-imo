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
	typeof (apexPrinter as { print?: unknown }).print !== 'function'
)
	throw new Error(
		'prettier-plugin-apex-imo requires prettier-plugin-apex to be installed. The apex printer was not found.',
	);
const wrappedPrinter = createWrappedPrinter(
	apexPrinter as Parameters<typeof createWrappedPrinter>[0],
);

const normalizeAnnotationNamesInText = (text: string): string =>
	text.replace(
		/@([a-zA-Z_][a-zA-Z0-9_]*)(\s*\(([^)]*)\)|(?![a-zA-Z0-9_(]))/g,
		(_match, name: string, params?: string) => {
			const normalizedName = normalizeAnnotationName(name);
			if (params === undefined || params.length === 0)
				return `@${normalizedName}`;
			return `@${normalizedName}${params.replace(
				/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g,
				(m, opt: string) => {
					const normalized = normalizeAnnotationOptionName(
						normalizedName,
						opt,
					);
					return normalized !== opt ? `${normalized}=` : m;
				},
			)}`;
		},
	);

const createPreprocess =
	(pluginInstance: Readonly<Plugin<ApexNode>>) =>
	async (
		text: Readonly<string>,
		options: Readonly<ParserOptions<ApexNode>>,
	): Promise<string> => {
		if (options.parser !== 'apex' && options.parser !== 'apex-anonymous')
			return text;
		const codeBlocks = findApexDocCodeBlocks(text);
		if (!codeBlocks.length) return text;
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
				formattedCode.startsWith('__FORMAT_FAILED__') ||
				(formattedCode === block.code &&
					processedText
						.substring(block.startPos, block.endPos)
						.includes('\n'))
			)
				continue;
			const { tabWidth, useTabs } = options;
			const closingIndent =
				useTabs === true
					? '\t'.repeat(Math.floor(block.commentIndent / tabWidth))
					: ' '.repeat(block.commentIndent);
			processedText =
				processedText.substring(0, block.startPos) +
				`{@code\n${applyCommentIndentation(formattedCode, block, options)}\n${closingIndent} * }` +
				processedText.substring(block.endPos);
		}
		return processedText;
	};

const wrapParsers = (
	parsers: Readonly<Plugin<ApexNode>['parsers']>,
	pluginInstance: Readonly<Plugin<ApexNode>>,
): Plugin<ApexNode>['parsers'] => {
	if (!parsers) return parsers;
	const ourPreprocess = createPreprocess(pluginInstance);
	const wrappedParsers: Record<string, unknown> = {};
	for (const parserName in parsers) {
		if (!Object.prototype.hasOwnProperty.call(parsers, parserName))
			continue;
		const originalParser = parsers[parserName];
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (typeof originalParser?.parse !== 'function') continue;
		const { preprocess: originalPreprocess } = originalParser;
		wrappedParsers[parserName] = {
			...originalParser,
			parse: async (
				text: Readonly<string>,
				options: Readonly<ParserOptions<ApexNode>>,
			): Promise<ApexNode> =>
				originalParser.parse(
					normalizeAnnotationNamesInText(text),
					options,
				),
			preprocess: async (
				text: Readonly<string>,
				options: Readonly<ParserOptions<ApexNode>>,
			): Promise<string> =>
				ourPreprocess(
					normalizeAnnotationNamesInText(
						originalPreprocess
							? await originalPreprocess(text, options)
							: text,
					),
					options,
				),
		};
	}
	return wrappedParsers as Plugin<ApexNode>['parsers'];
};

const apexPluginTyped = apexPlugin as unknown as Plugin<ApexNode>;
const plugin: Plugin<ApexNode> = {
	...apexPluginTyped,
	printers: { apex: wrappedPrinter },
};
plugin.parsers = wrapParsers(apexPluginTyped.parsers, plugin);
export default plugin;
export const { languages, parsers, printers, options, defaultOptions } = plugin;
