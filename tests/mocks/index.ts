/**
 * @file Central export point for all test mocks.
 * Re-exports all mock factories for convenient importing.
 */

// Prettier mocks
export {
	PrettierMockSuite,
	createPrettierMock,
	createMockPrettierPluginApex,
	defaultPrettierMock,
} from './prettier.js';

// Node mocks
export {
	NODE_CLASS_KEY,
	createMockIdentifier,
	createMockAnnotation,
	createMockAnnotationStringParameter,
	createMockAnnotationKeyValueParameter,
	createMockTypeRef,
	createMockListInit,
	createMockSetInit,
	createMockMapInit,
	createMockBlockComment,
	createMockMethodDecl,
	createMockVariableDecls,
	createMockVariable,
	createMockLiteralExpr,
	createMockMapLiteralKeyValue,
} from './nodes.js';

// Path mocks
export {
	createMockPath,
	createMockTypePath,
	createMockTypesPath,
	createMockNamesPath,
	createMockArrayPath,
	createMockPathWithParent,
	createMockTypePathWithParent,
} from './paths.js';

// Printer mocks
export {
	createMockPrint,
	createMockOriginalPrinter,
	createMockPrinter,
} from './printers.js';

// Options mocks
export {
	createMockOptions,
	createMockOptionsWithTabs,
	createMockOptionsWithPrintWidth,
	createMockOptionsWithTabWidth,
} from './options.js';
