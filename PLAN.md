# prettier-plugin-apex-imo - Cursor Vibe Coding Plan

## Project Overview

**Repository:** `starch-uk/prettier-plugin-apex-imo`  
**Package Name:** `prettier-plugin-apex-imo`  
**Description:** An opinionated enhancement plugin for `prettier-plugin-apex`
that enforces multiline formatting for Apex Lists and Maps with multiple
entries, and formats code inside ApexDoc `{@code}` blocks.

### The Problem

When using `prettier-plugin-apex`, code like this:

```apex
final String expectedJson = String.join(new List<String>{
  '{',
  '  "tags" : [ "reading", "gaming", "coding" ]',
  '}'
}, '\n');
```

Gets reformatted to a single line:

```apex
final String expectedJson = String.join(new List<String>{ '{', '  "tags" : [ "reading", "gaming", "coding" ]', '}' }, '\n');
```

This defeats the purpose of laying out code nicely for maintainability.

### The Solution

This plugin wraps `prettier-plugin-apex` and modifies the printing behavior for:

- **List literals** with 2+ entries → Always multiline
- **Set literals** with 2+ entries → Always multiline
- **Map literals** with 2+ entries → Always multiline
- **ApexDoc `{@code}` blocks** → Code inside is formatted using Prettier

**Important:** This is non-configurable behavior. Once installed, it just works.

---

## Project Structure

```
prettier-plugin-apex-imo/
├── src/
│   ├── index.ts              # Main plugin entry point
│   ├── printer.ts            # Custom printer wrapping apex printer
│   ├── types.ts              # TypeScript type definitions
│   └── utils.ts              # Utility functions
├── tests/
│   ├── __fixtures__/         # Test input/output fixtures
│   │   ├── list-multiline/
│   │   │   ├── input.cls
│   │   │   └── output.cls
│   │   ├── list-single/
│   │   │   ├── input.cls
│   │   │   └── output.cls
│   │   ├── map-multiline/
│   │   │   ├── input.cls
│   │   │   └── output.cls
│   │   ├── map-single/
│   │   │   ├── input.cls
│   │   │   └── output.cls
│   │   ├── set-multiline/
│   │   │   ├── input.cls
│   │   │   └── output.cls
│   │   ├── set-single/
│   │   │   ├── input.cls
│   │   │   └── output.cls
│   │   ├── mixed/
│   │   │   ├── input.cls
│   │   │   └── output.cls
│   │   └── nested/
│   │       ├── input.cls
│   │       └── output.cls
│   ├── printer.test.ts       # Printer unit tests
│   └── integration.test.ts   # End-to-end formatting tests
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md     # Bug report issue template
│   │   └── feature_request.md # Feature request issue template
│   ├── workflows/
│   │   └── ci.yml            # CI pipeline
│   ├── dependabot.yml        # Dependabot configuration
│   └── PULL_REQUEST_TEMPLATE.md # Pull request template
├── docs/                     # Additional documentation
│   ├── ESLINT.md            # ESLint reference
│   ├── HUSKY9.md            # Husky v9 reference
│   └── PNPM.md              # pnpm reference
├── package.json
├── tsconfig.json
├── tsup.config.ts            # Build configuration
├── vitest.config.ts          # Test configuration
├── .prettierrc
├── eslint.config.js          # ESLint flat config
├── .gitignore
├── CODE_OF_CONDUCT.md        # Contributor Code of Conduct
├── CONTRIBUTING.md           # Contributing guidelines
├── LICENSE.md                # MIT License
├── README.md
├── SECURITY.md
└── CHANGELOG.md
```

---

## Phase 1: Project Initialization

### 1.1 Initialize pnpm Package

```bash
mkdir prettier-plugin-apex-imo
cd prettier-plugin-apex-imo
pnpm init
```

Update `package.json`:

```json
{
	"name": "prettier-plugin-apex-imo",
	"version": "0.1.0",
	"description": "Opinionated multiline formatting for Apex Lists and Maps - extends prettier-plugin-apex",
	"keywords": [
		"prettier",
		"plugin",
		"apex",
		"salesforce",
		"formatter",
		"multiline",
		"list",
		"map"
	],
	"homepage": "https://github.com/starch-uk/prettier-plugin-apex-imo#readme",
	"bugs": {
		"url": "https://github.com/starch-uk/prettier-plugin-apex-imo/issues"
	},
	"repository": {
		"type": "git",
		"url": "git+https://github.com/starch-uk/prettier-plugin-apex-imo.git"
	},
	"license": "MIT",
	"author": "Starch UK <info@starch.uk>",
	"type": "module",
	"exports": {
		".": {
			"import": "./dist/index.js",
			"require": "./dist/index.cjs",
			"types": "./dist/index.d.ts"
		}
	},
	"main": "./dist/index.cjs",
	"module": "./dist/index.js",
	"types": "./dist/index.d.ts",
	"files": ["dist"],
	"scripts": {
		"build": "tsup",
		"dev": "tsup --watch",
		"test": "vitest",
		"test:coverage": "vitest --coverage",
		"test:ci": "vitest run --coverage",
		"lint": "eslint .",
		"lint:fix": "eslint . --fix",
		"typecheck": "tsc --noEmit",
		"prepublishOnly": "pnpm run build",
		"format": "prettier --write .",
		"format:check": "prettier --check .",
		"prepare": "husky"
	},
	"packageManager": "pnpm@10.26.2",
	"peerDependencies": {
		"prettier": "^3.0.0",
		"prettier-plugin-apex": "^2.0.0"
	},
	"devDependencies": {
		"@types/node": "^20.0.0",
		"@typescript-eslint/eslint-plugin": "^7.0.0",
		"@typescript-eslint/parser": "^7.0.0",
		"@vitest/coverage-v8": "^2.0.0",
		"eslint": "^8.0.0",
		"prettier": "^3.4.0",
		"prettier-plugin-apex": "^2.2.0",
		"tsup": "^8.0.0",
		"typescript": "^5.0.0",
		"vitest": "^2.0.0"
	},
	"engines": {
		"node": ">=20"
	}
}
```

### 1.2 TypeScript Configuration

Create `tsconfig.json`:

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "ESNext",
		"moduleResolution": "bundler",
		"lib": ["ES2022"],
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true,
		"forceConsistentCasingInFileNames": true,
		"declaration": true,
		"declarationMap": true,
		"sourceMap": true,
		"outDir": "./dist",
		"rootDir": "./src",
		"resolveJsonModule": true,
		"isolatedModules": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		"noImplicitReturns": true,
		"noFallthroughCasesInSwitch": true
	},
	"include": ["src/**/*"],
	"exclude": ["node_modules", "dist", "tests"]
}
```

### 1.3 Build Configuration

Create `tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	clean: true,
	sourcemap: true,
	minify: false,
	target: 'node20',
	external: ['prettier', 'prettier-plugin-apex'],
});
```

### 1.4 Test Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: ['src/types.ts'],
			thresholds: {
				lines: 100,
				functions: 100,
				branches: 100,
				statements: 100,
			},
		},
	},
});
```

---

## Phase 2: Core Implementation

### 2.1 Type Definitions

Create `src/types.ts`:

```typescript
import type { AstPath, Doc, ParserOptions, Plugin, Printer } from 'prettier';

/**
 * Apex AST node types we care about for multiline formatting
 */
export interface ApexListInitNode {
	'@class':
		| 'apex.jorje.data.ast.NewObject$NewListLiteral'
		| 'apex.jorje.data.ast.NewObject$NewSetLiteral';
	values: ApexNode[];
	[key: string]: unknown;
}

export interface ApexMapInitNode {
	'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral';
	pairs: ApexMapPair[];
	[key: string]: unknown;
}

export interface ApexMapPair {
	'@class': 'apex.jorje.data.ast.MapLiteralKeyValue';
	key: ApexNode;
	value: ApexNode;
	[key: string]: unknown;
}

export interface ApexNode {
	'@class': string;
	[key: string]: unknown;
}

export type ApexAst = ApexNode;

export interface ApexPrinterOptions extends ParserOptions {
	originalText: string;
}

export type ApexPath = AstPath<ApexNode>;

export type PrintFn = (path: AstPath) => Doc;

export interface ApexPrinter extends Printer<ApexNode> {
	print: (path: ApexPath, options: ApexPrinterOptions, print: PrintFn) => Doc;
}

export interface ApexPlugin extends Plugin<ApexNode> {
	printers: {
		apex: ApexPrinter;
	};
}
```

### 2.2 Utility Functions

Create `src/utils.ts`:

```typescript
import type { ApexNode, ApexListInitNode, ApexMapInitNode } from './types.js';

/**
 * Check if node is a List or Set literal initializer
 */
export function isListInit(node: ApexNode): node is ApexListInitNode {
	const nodeClass = node['@class'];
	return (
		nodeClass === 'apex.jorje.data.ast.NewObject$NewListLiteral' ||
		nodeClass === 'apex.jorje.data.ast.NewObject$NewSetLiteral'
	);
}

/**
 * Check if node is a Map literal initializer
 */
export function isMapInit(node: ApexNode): node is ApexMapInitNode {
	return node['@class'] === 'apex.jorje.data.ast.NewObject$NewMapLiteral';
}

/**
 * Check if a List/Set has multiple entries (2+)
 */
export function hasMultipleListEntries(node: ApexListInitNode): boolean {
	return Array.isArray(node.values) && node.values.length >= 2;
}

/**
 * Check if a Map has multiple entries (2+)
 */
export function hasMultipleMapEntries(node: ApexMapInitNode): boolean {
	return Array.isArray(node.pairs) && node.pairs.length >= 2;
}

/**
 * Determine if this node should be forced to multiline
 */
export function shouldForceMultiline(node: ApexNode): boolean {
	if (isListInit(node)) {
		return hasMultipleListEntries(node);
	}
	if (isMapInit(node)) {
		return hasMultipleMapEntries(node);
	}
	return false;
}
```

### 2.3 Custom Printer

Create `src/printer.ts`:

```typescript
import { doc, type AstPath, type Doc, type ParserOptions } from 'prettier';
import type {
	ApexNode,
	ApexListInitNode,
	ApexMapInitNode,
	PrintFn,
} from './types.js';
import {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
} from './utils.js';

const { group, indent, line, hardline, softline, join } = doc.builders;

/**
 * Print a List or Set literal with forced multiline when 2+ entries
 */
function printListInit(
	path: AstPath<ApexListInitNode>,
	options: ParserOptions,
	print: PrintFn,
	originalPrint: () => Doc,
): Doc {
	const node = path.node;

	// Only force multiline for 2+ entries
	if (!hasMultipleListEntries(node)) {
		return originalPrint();
	}

	// The NewObject$NewListLiteral or NewObject$NewSetLiteral node contains both types and values
	// We need to print: List<types> or Set<types> + multiline literal
	// Print the types using path.map(print, 'types')
	const printedTypes = path.map(print, 'types' as never) as unknown as Doc[];
	const nodeClass = node['@class'];
	const isSet = nodeClass === 'apex.jorje.data.ast.NewObject$NewSetLiteral';

	// List types are joined with '.', Set types are joined with ', '
	const typesDoc = isSet
		? join([',', ' '], printedTypes)
		: join('.', printedTypes);

	// Print multiline literal
	const printedValues = path.map(
		print,
		'values' as never,
	) as unknown as Doc[];
	const multilineLiteral = group([
		'{',
		indent([hardline, join([',', hardline], printedValues)]),
		hardline,
		'}',
	]);

	// Construct the full expression: List<types> or Set<types> + multiline literal
	const typeName = isSet ? 'Set' : 'List';
	return group([typeName + '<', typesDoc, '>', multilineLiteral]);
}

/**
 * Print a Map literal with forced multiline when 2+ entries
 */
function printMapInit(
	path: AstPath<ApexMapInitNode>,
	options: ParserOptions,
	print: PrintFn,
	originalPrint: () => Doc,
): Doc {
	const node = path.node;

	// Only force multiline for 2+ entries
	if (!hasMultipleMapEntries(node)) {
		return originalPrint();
	}

	// The NewObject$NewMapLiteral node contains both types and pairs
	// We need to print: Map<types> + multiline literal
	// Print the types using path.map(print, 'types')
	const printedTypes = path.map(print, 'types' as never) as unknown as Doc[];
	const typesDoc = join(', ', printedTypes); // Map types are joined with ', '

	// Force multiline: each key-value pair on its own line
	const printedPairs = path.map((pairPath) => {
		return [
			pairPath.call(print, 'key' as never) as unknown as Doc,
			' => ',
			pairPath.call(print, 'value' as never) as unknown as Doc,
		];
	}, 'pairs' as never) as unknown as Doc[][];

	const multilineLiteral = group([
		'{',
		indent([hardline, join([',', hardline], printedPairs)]),
		hardline,
		'}',
	]);

	// Construct the full expression: Map<types> + multiline literal
	return group(['Map<', typesDoc, '>', multilineLiteral]);
}

/**
 * Create a wrapped printer that intercepts List/Map literals
 */
export function createWrappedPrinter(originalPrinter: {
	print: (
		path: AstPath<ApexNode>,
		options: ParserOptions,
		print: PrintFn,
	) => Doc;
}) {
	return {
		...originalPrinter,
		print(
			path: AstPath<ApexNode>,
			options: ParserOptions,
			print: PrintFn,
		): Doc {
			const node = path.node;

			// Create a thunk for the original print behavior
			const originalPrint = () =>
				originalPrinter.print(path, options, print);

			// Intercept List/Set literals directly
			// The NewObject$NewListLiteral/NewSetLiteral node contains types and values
			// We intercept here and construct the full expression (types + multiline literal)
			if (isListInit(node)) {
				return printListInit(
					path as AstPath<ApexListInitNode>,
					options,
					print,
					() => originalPrinter.print(path, options, print),
				);
			}

			// Intercept Map literals
			if (isMapInit(node)) {
				return printMapInit(
					path as AstPath<ApexMapInitNode>,
					options,
					print,
					() => originalPrinter.print(path, options, print),
				);
			}

			// All other nodes: use original printer
			return originalPrinter.print(path, options, print);
		},
	};
}
```

### 2.4 Main Plugin Entry Point

Create `src/index.ts`:

```typescript
import type { Plugin } from 'prettier';
// @ts-expect-error - prettier-plugin-apex types may not be fully typed
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
```

---

## Phase 3: Test Suite

### 3.1 Test Fixtures

### 3.1 Test Fixtures

Create `tests/__fixtures__/list-single/input.cls`:

```apex
public class ListSingleTest {
    public void singleItem() {
        List<String> items = new List<String>{ 'one' };
    }
}
```

Create `tests/__fixtures__/list-single/output.cls`:

```apex
public class ListSingleTest {
  public void singleItem() {
    List<String> items = new List<String>{ 'one' };
  }
}
```

Create `tests/__fixtures__/list-multiline/input.cls`:

```apex
public class ListMultilineTest {
    public void multipleItems() {
        List<String> items = new List<String>{ 'one', 'two', 'three' };
        List<String> json = new List<String>{ '{', '  "name": "test"', '}' };
    }
}
```

Create `tests/__fixtures__/list-multiline/output.cls`:

```apex
public class ListMultilineTest {
  public void multipleItems() {
    List<String> items = new List<String>{
      'one',
      'two',
      'three'
    };
    List<String> json = new List<String>{
      '{',
      '  "name": "test"',
      '}'
    };
  }
}
```

Create `tests/__fixtures__/map-single/input.cls`:

```apex
public class MapSingleTest {
    public void singlePair() {
        Map<String, Integer> counts = new Map<String, Integer>{ 'a' => 1 };
    }
}
```

Create `tests/__fixtures__/map-single/output.cls`:

```apex
public class MapSingleTest {
  public void singlePair() {
    Map<String, Integer> counts = new Map<String, Integer>{ 'a' => 1 };
  }
}
```

Create `tests/__fixtures__/map-multiline/input.cls`:

```apex
public class MapMultilineTest {
    public void multiplePairs() {
        Map<String, Integer> counts = new Map<String, Integer>{ 'a' => 1, 'b' => 2, 'c' => 3 };
    }
}
```

Create `tests/__fixtures__/set-single/input.cls`:

```apex
public class SetSingleTest {
    public void singleItem() {
        Set<String> items = new Set<String>{ 'one' };
    }
}
```

Create `tests/__fixtures__/set-single/output.cls`:

```apex
public class SetSingleTest {
  public void singleItem() {
    Set<String> items = new Set<String>{ 'one' };
  }
}
```

Create `tests/__fixtures__/set-multiline/input.cls`:

```apex
public class SetMultilineTest {
    public void multipleItems() {
        Set<String> items = new Set<String>{ 'one', 'two', 'three' };
        Set<Integer> numbers = new Set<Integer>{ 1, 2, 3, 4 };
    }
}
```

Create `tests/__fixtures__/set-multiline/output.cls`:

```apex
public class SetMultilineTest {
  public void multipleItems() {
    Set<String> items = new Set<String>{
      'one',
      'two',
      'three'
    };
    Set<Integer> numbers = new Set<Integer>{
      1,
      2,
      3,
      4
    };
  }
}
```

Create `tests/__fixtures__/nested/input.cls`:

```apex
public class NestedTest {
    public void nestedStructures() {
        // Map with List values (nested lists should be multiline)
        Map<String, List<String> > mapWithLists = new Map<String, List<String> >{
            'tags' => new List<String>{ 'reading', 'gaming' },
            'categories' => new List<String>{ 'tech', 'books', 'games' }
        };
    }
}
```

Create `tests/__fixtures__/nested/output.cls`:

```apex
public class NestedTest {
  public void nestedStructures() {
    // Map with List values (nested lists should be multiline)
    Map<String, List<String>> mapWithLists = new Map<String, List<String>>{
      'tags' => new List<String>{
        'reading',
        'gaming'
      },
      'categories' => new List<String>{
        'tech',
        'books',
        'games'
      }
    };
  }
}
```

Create `tests/__fixtures__/map-multiline/output.cls`:

```apex
public class MapMultilineTest {
  public void multiplePairs() {
    Map<String, Integer> counts = new Map<String, Integer>{
      'a' => 1,
      'b' => 2,
      'c' => 3
    };
  }
}
```

Create `tests/__fixtures__/mixed/input.cls`:

```apex
public class MixedTest {
    public void mixedScenarios() {
        // Single item list - should stay inline
        List<String> single = new List<String>{ 'only' };

        // Multiple item list - should be multiline
        List<String> multiple = new List<String>{ 'one', 'two' };

        // Single pair map - should stay inline
        Map<String, String> singleMap = new Map<String, String>{ 'key' => 'value' };

        // Multiple pair map - should be multiline
        Map<String, String> multiMap = new Map<String, String>{ 'a' => '1', 'b' => '2' };

        // Nested structures
        Map<String, List<String>> nested = new Map<String, List<String>>{
            'tags' => new List<String>{ 'one', 'two' },
            'categories' => new List<String>{ 'a', 'b', 'c' }
        };
    }
}
```

Create `tests/__fixtures__/mixed/output.cls`:

```apex
public class MixedTest {
  public void mixedScenarios() {
    // Single item list - should stay inline
    List<String> single = new List<String>{ 'only' };

    // Multiple item list - should be multiline
    List<String> multiple = new List<String>{
      'one',
      'two'
    };

    // Single pair map - should stay inline
    Map<String, String> singleMap = new Map<String, String>{ 'key' => 'value' };

    // Multiple pair map - should be multiline
    Map<String, String> multiMap = new Map<String, String>{
      'a' => '1',
      'b' => '2'
    };

    // Nested structures
    Map<String, List<String>> nested = new Map<String, List<String>>{
      'tags' => new List<String>{
        'one',
        'two'
      },
      'categories' => new List<String>{
        'a',
        'b',
        'c'
      }
    };
  }
}
```

### 3.2 Unit Tests

Create `tests/printer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
	isListInit,
	isMapInit,
	hasMultipleListEntries,
	hasMultipleMapEntries,
	shouldForceMultiline,
} from '../src/utils.js';

describe('utils', () => {
	describe('isListInit', () => {
		it('should identify NewListLiteral nodes', () => {
			expect(
				isListInit({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(true);
		});

		it('should identify NewSetLiteral nodes', () => {
			expect(
				isListInit({
					'@class': 'apex.jorje.data.ast.NewObject$NewSetLiteral',
					values: [],
				}),
			).toBe(true);
		});

		it('should reject other node types', () => {
			expect(
				isListInit({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(false);
		});
	});

	describe('isMapInit', () => {
		it('should identify NewMapLiteral nodes', () => {
			expect(
				isMapInit({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(true);
		});

		it('should reject other node types', () => {
			expect(
				isMapInit({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(false);
		});
	});

	describe('hasMultipleListEntries', () => {
		it('should return false for empty list', () => {
			expect(
				hasMultipleListEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [],
				}),
			).toBe(false);
		});

		it('should return false for single item', () => {
			expect(
				hasMultipleListEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [{ '@class': 'apex.jorje.data.ast.LiteralExpr' }],
				}),
			).toBe(false);
		});

		it('should return true for 2+ items', () => {
			expect(
				hasMultipleListEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(true);
		});
	});

	describe('hasMultipleMapEntries', () => {
		it('should return false for empty map', () => {
			expect(
				hasMultipleMapEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [],
				}),
			).toBe(false);
		});

		it('should return false for single pair', () => {
			expect(
				hasMultipleMapEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
				}),
			).toBe(false);
		});

		it('should return true for 2+ pairs', () => {
			expect(
				hasMultipleMapEntries({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
				}),
			).toBe(true);
		});
	});

	describe('shouldForceMultiline', () => {
		it('should return true for list with multiple entries', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewListLiteral',
					values: [
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
						{ '@class': 'apex.jorje.data.ast.LiteralExpr' },
					],
				}),
			).toBe(true);
		});

		it('should return true for map with multiple entries', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.NewObject$NewMapLiteral',
					pairs: [
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
						{
							'@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
							key: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
							value: {
								'@class': 'apex.jorje.data.ast.LiteralExpr',
							},
						},
					],
				}),
			).toBe(true);
		});

		it('should return false for other nodes', () => {
			expect(
				shouldForceMultiline({
					'@class': 'apex.jorje.data.ast.MethodDecl',
				}),
			).toBe(false);
		});
	});
});
```

### 3.3 Integration Tests

Create `tests/integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as prettier from 'prettier';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import our plugin
import plugin from '../src/index.js';

async function formatApex(code: string): Promise<string> {
	return prettier.format(code, {
		parser: 'apex',
		plugins: [plugin],
		tabWidth: 2,
	});
}

function loadFixture(name: string, file: 'input' | 'output'): string {
	const fixturePath = path.join(
		__dirname,
		'__fixtures__',
		name,
		`${file}.cls`,
	);
	return fs.readFileSync(fixturePath, 'utf-8');
}

describe('prettier-plugin-apex-imo integration', () => {
	describe('List formatting', () => {
		it('should keep single-item lists inline', async () => {
			const input = loadFixture('list-single', 'input');
			const expected = loadFixture('list-single', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format multi-item lists as multiline', async () => {
			const input = loadFixture('list-multiline', 'input');
			const expected = loadFixture('list-multiline', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});
	});

	describe('Set formatting', () => {
		it('should keep single-item sets inline', async () => {
			const input = loadFixture('set-single', 'input');
			const expected = loadFixture('set-single', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format multi-item sets as multiline', async () => {
			const input = loadFixture('set-multiline', 'input');
			const expected = loadFixture('set-multiline', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});
	});

	describe('Map formatting', () => {
		it('should keep single-pair maps inline', async () => {
			const input = loadFixture('map-single', 'input');
			const expected = loadFixture('map-single', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});

		it('should format multi-pair maps as multiline', async () => {
			const input = loadFixture('map-multiline', 'input');
			const expected = loadFixture('map-multiline', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});
	});

	describe('Nested structures', () => {
		it('should handle Map with List values (nested lists)', async () => {
			const input = loadFixture('nested', 'input');
			const expected = loadFixture('nested', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});
	});

	describe('Mixed scenarios', () => {
		it('should handle mixed list/map scenarios correctly', async () => {
			const input = loadFixture('mixed', 'input');
			const expected = loadFixture('mixed', 'output');
			const result = await formatApex(input);
			expect(result).toBe(expected);
		});
	});

	describe('Edge cases', () => {
		it('should handle empty lists', async () => {
			const input = `public class Test { List<String> empty = new List<String>{}; }`;
			const result = await formatApex(input);
			expect(result).toContain('new List<String>{}');
		});

		it('should handle empty maps', async () => {
			const input = `public class Test { Map<String,String> empty = new Map<String,String>{}; }`;
			const result = await formatApex(input);
			expect(result).toContain('new Map<String, String>{}');
		});

		it('should handle Set literals like List literals', async () => {
			const input = `public class Test { Set<String> items = new Set<String>{ 'a', 'b' }; }`;
			const result = await formatApex(input);
			expect(result).toContain("'a',");
			expect(result).toContain("'b'");
		});
	});
});
```

---

## Phase 4: Documentation

### 4.1 README.md

````markdown
# prettier-plugin-apex-imo

[![npm version](https://img.shields.io/npm/v/prettier-plugin-apex-imo.svg)](https://www.npmjs.com/package/prettier-plugin-apex-imo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/starch-uk/prettier-plugin-apex-imo/actions/workflows/ci.yml/badge.svg)](https://github.com/starch-uk/prettier-plugin-apex-imo/actions/workflows/ci.yml)

> **IMO** = In My Opinion — because Prettier is opinionated, and so am I.

An opinionated enhancement for
[prettier-plugin-apex](https://github.com/dangmai/prettier-plugin-apex) that
enforces multiline formatting for Apex Lists and Maps with multiple entries.

## The Problem

When using `prettier-plugin-apex`, code like this:

```apex
final String expectedJson = String.join(new List<String>{
  '{',
  '  "tags" : [ "reading", "gaming", "coding" ]',
  '}'
}, '\n');
```
````

Gets reformatted to a single line, defeating the purpose of readable formatting.

## The Solution

This plugin wraps `prettier-plugin-apex` and modifies the printing behaviour:

- **List literals** with 2+ entries → Always multiline
- **Map literals** with 2+ entries → Always multiline
- **Set literals** with 2+ entries → Always multiline

This is **non-configurable** behaviour. Once installed, it just works.

## Installation

```bash
pnpm add -D prettier prettier-plugin-apex prettier-plugin-apex-imo
```

Or with npm:

```bash
npm install --save-dev prettier prettier-plugin-apex prettier-plugin-apex-imo
```

## Usage

Add the plugin to your Prettier configuration:

```json
{
	"plugins": ["prettier-plugin-apex-imo"]
}
```

That's it! The plugin automatically includes `prettier-plugin-apex`, so you only
need to specify this one.

### CLI

```bash
prettier --plugin=prettier-plugin-apex-imo --write "**/*.{cls,trigger}"
```

## Examples

### Before (prettier-plugin-apex)

```apex
List<String> items = new List<String>{ 'one', 'two', 'three' };
Map<String, Integer> counts = new Map<String, Integer>{ 'a' => 1, 'b' => 2 };
```

### After (prettier-plugin-apex-imo)

```apex
List<String> items = new List<String>{
  'one',
  'two',
  'three'
};
Map<String, Integer> counts = new Map<String, Integer>{
  'a' => 1,
  'b' => 2
};
```

### Single Items (unchanged)

```apex
// These stay on one line
List<String> single = new List<String>{ 'only' };
Map<String, Integer> singleMap = new Map<String, Integer>{ 'key' => 1 };
```

## Requirements

- Node.js >= 20
- Prettier >= 3.0.0
- prettier-plugin-apex >= 2.0.0

## Why "imo"?

Prettier has a strict
[option philosophy](https://prettier.io/docs/option-philosophy) that discourages
adding new formatting options. While I respect this philosophy, I believe the
current behaviour for multi-item Lists and Maps is suboptimal for code
readability.

Rather than fork `prettier-plugin-apex` or maintain options, this plugin
provides a simple, opinionated wrapper that enforces the behaviour I (and
hopefully others) prefer.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for
details.

## Security

For security issues, please email security@starch.uk. See
[SECURITY.md](SECURITY.md) for details.

## License

MIT © Starch UK

## Acknowledgements

- [prettier-plugin-apex](https://github.com/dangmai/prettier-plugin-apex) by
  Dang Mai
- [Prettier](https://prettier.io/) for the amazing formatting engine

````

### 4.2 SECURITY.md

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within prettier-plugin-apex-imo, please send an email to security@starch.uk.

All security vulnerabilities will be promptly addressed.

Please include the following information:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

## Response Timeline

- **Initial Response:** Within 48 hours
- **Status Update:** Within 7 days
- **Resolution Target:** Within 30 days (depending on complexity)

## Preferred Languages

We prefer all communications to be in English.

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine the affected versions
2. Audit code to find any potential similar problems
3. Prepare fixes for all releases still under maintenance
4. Release new versions and announce the fix

We will credit reporters in our release notes unless they wish to remain anonymous.
````

### 4.3 LICENSE

```
MIT License

Copyright (c) 2025 Starch UK

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Phase 5: CI/CD Configuration

### 5.1 GitHub Actions CI

Create `.github/workflows/ci.yml`:

```yaml
name: CI
permissions:
    contents: read

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    build:
        runs-on: ubuntu-latest
        strategy:
            matrix:
                node-version: [20, 22, 24]

        steps:
            - uses: actions/checkout@v6

            - name: Install pnpm
              uses: pnpm/action-setup@v4

            - name: Use Node.js ${{ matrix.node-version }}
              uses: actions/setup-node@v6
              with:
                  node-version: ${{ matrix.node-version }}
                  cache: 'pnpm'

            - name: Install dependencies
              run: pnpm install --frozen-lockfile

            - name: Type check
              run: pnpm run typecheck

            - name: Lint
              run: pnpm run lint

            - name: Build
              run: pnpm run build

            - name: Test
              run: pnpm run test:ci

            - name: Upload coverage
              uses: codecov/codecov-action@v5
              if: matrix.node-version == 24
              with:
                  token: ${{ secrets.CODECOV_TOKEN }}
                  files: ./coverage/lcov.info
                  fail_ci_if_error: false
```

### 5.2 GitHub Actions Release

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
    push:
        tags:
            - 'v*'

jobs:
    release:
        runs-on: ubuntu-latest
        permissions:
            contents: write
            id-token: write

        steps:
            - uses: actions/checkout@v6

            - name: Install pnpm
              uses: pnpm/action-setup@v4

            - name: Use Node.js
              uses: actions/setup-node@v6
              with:
                  node-version: 24
                  cache: 'pnpm'
                  registry-url: 'https://registry.npmjs.org'

            - name: Install dependencies
              run: pnpm install --frozen-lockfile

            - name: Build
              run: pnpm run build

            - name: Test
              run: pnpm run test:ci

            - name: Publish to npm
              run: pnpm publish --provenance --access public
              env:
                  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

            - name: Create GitHub Release
              uses: softprops/action-gh-release@v2
              with:
                  generate_release_notes: true
```

---

## Phase 6: Additional Configuration Files

### 6.1 .gitignore

```
# Dependencies
node_modules/

# Build outputs
dist/

# Coverage
coverage/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Debug
*.log
npm-debug.log*

# Environment
.env
.env.local
```

### 6.2 .prettierrc

```json
{
	"semi": true,
	"singleQuote": true,
	"trailingComma": "all",
	"printWidth": 80,
	"tabWidth": 4,
	"useTabs": true
}
```

### 6.3 eslint.config.js (ESLint Flat Config)

Create `eslint.config.js`:

```typescript
import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';

// Get all available configs from the plugin
const recommendedConfig = plugin.configs.recommended || {};
const strictConfig = plugin.configs.strict || {};
const stylisticConfig = plugin.configs.stylistic || {};
const recommendedTypeCheckedConfig =
	plugin.configs['recommended-type-checked'] ||
	plugin.configs.recommendedTypeChecked ||
	{};
const strictTypeCheckedConfig =
	plugin.configs['strict-type-checked'] ||
	plugin.configs.strictTypeChecked ||
	{};

// Enable all rules from all configs
const configRules = {
	// Enable all TypeScript ESLint recommended rules
	...(recommendedConfig.rules || {}),
	// Enable all TypeScript ESLint strict rules
	...(strictConfig.rules || {}),
	// Enable all TypeScript ESLint stylistic rules
	...(stylisticConfig.rules || {}),
	// Enable all TypeScript ESLint type-checked rules
	...(recommendedTypeCheckedConfig.rules || {}),
	...(strictTypeCheckedConfig.rules || {}),
};

// Enable all individual rules from the plugin that aren't in configs
// This ensures every rule is enabled, not just those in presets
const allPluginRules = {};
if (plugin.rules) {
	for (const [ruleName, rule] of Object.entries(plugin.rules)) {
		const fullRuleName = `@typescript-eslint/${ruleName}`;
		// Only enable if not already set by a config (configs take precedence)
		if (!(fullRuleName in configRules)) {
			// Enable the rule (use 'error' as default, can be overridden)
			allPluginRules[fullRuleName] = 'error';
		}
	}
}

// Combine all rules
const allRules = {
	// Disable base ESLint rules that conflict with TypeScript versions
	'no-unused-vars': 'off',
	'no-redeclare': 'off',
	'no-undef': 'off',
	// All rules from configs
	...configRules,
	// All individual plugin rules not in configs
	...allPluginRules,
	// Customize specific rules (these override any config defaults)
	'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
};

export default [
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser,
			parserOptions: {
				ecmaVersion: 2022,
				sourceType: 'module',
				projectService: true,
			},
		},
		plugins: {
			'@typescript-eslint': plugin,
		},
		rules: allRules,
	},
	{
		ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
	},
];
```

### 6.4 CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - YYYY-MM-DD

### Added

- Initial release
- Force multiline formatting for List literals with 2+ entries
- Force multiline formatting for Set literals with 2+ entries
- Force multiline formatting for Map literals with 2+ entries
- Full unit and integration test suite
```

---

## Implementation Notes for Cursor

### Key Technical Considerations

1. **AST Node Types**: The exact `@class` values need to be verified against the
   actual `prettier-plugin-apex` AST. The values used in this plan are educated
   guesses based on the jorje parser naming conventions.

2. **Printer Wrapping Strategy**: The approach of wrapping the original printer
   and selectively intercepting specific node types is the cleanest way to
   extend functionality without forking.

3. **Doc Builders**: The `hardline` builder is used to force line breaks. This
   is different from `line` which allows Prettier to decide.

4. **Testing with Apex Parser**: Integration tests require the Apex parser to be
   available. If running on a platform without native executables, Java 11+ is
   required.

5. **Edge Cases to Consider**:
    - Nested structures (Map containing Lists)
    - Very long single-item values that might wrap
    - Comments within List/Map literals
    - Trailing commas

### Cursor Prompts for Each Phase

**Phase 1:**

> "Initialize a new TypeScript npm package for a Prettier plugin called
> prettier-plugin-apex-imo. Set up tsup for building, vitest for testing, and
> configure ESM + CJS dual exports."

**Phase 2:**

> "Implement the core plugin logic that wraps prettier-plugin-apex and overrides
> the printer for List and Map literals to force multiline when there are 2+
> entries. Use the Prettier doc builders."

**Phase 3:**

> "Create comprehensive tests including unit tests for utility functions and
> integration tests that use Prettier to format actual Apex code fixtures."

**Phase 4:**

> "Write the README, SECURITY.md, and LICENSE.md files for the package."

**Phase 5:**

> "Set up GitHub Actions CI/CD with test, build, and npm publish workflows."

---

## Appendix A: Discovering Exact AST Node Types

The plan uses educated guesses for AST node class names. Before implementation,
verify the exact node types using these techniques:

### A.1 Using the Playground

Visit https://apex.dangmai.net and:

1. Enter sample code with List/Map literals
2. Check the "Show AST" option
3. Examine the JSON output for `@class` values

### A.2 Debugging During Development

Add temporary logging to discover node types:

```typescript
// In printer.ts, add at the start of the print function:
console.log('Node type:', node['@class'], 'Keys:', Object.keys(node));
```

### A.3 Known Node Types (from research)

Based on GitHub issues and source analysis:

| Apex Construct                | Actual `@class` Value                          |
| ----------------------------- | ---------------------------------------------- |
| List literal `new List<T>{ }` | `apex.jorje.data.ast.NewObject$NewListLiteral` |
| Set literal `new Set<T>{ }`   | `apex.jorje.data.ast.NewObject$NewSetLiteral`  |
| Map literal `new Map<K,V>{ }` | `apex.jorje.data.ast.NewObject$NewMapLiteral`  |
| Map key-value pair            | `apex.jorje.data.ast.MapLiteralKeyValue`       |

### A.4 Alternative Approach: Introspection Script

Create a helper script to dump node types:

```typescript
// scripts/inspect-ast.ts
import * as prettier from 'prettier';
import * as apexPlugin from 'prettier-plugin-apex';

const code = `
public class Test {
  List<String> items = new List<String>{ 'a', 'b' };
  Map<String, Integer> map = new Map<String, Integer>{ 'x' => 1, 'y' => 2 };
}
`;

async function inspect() {
	// Access the parser directly
	const ast = await apexPlugin.parsers.apex.parse(code, {});
	console.log(JSON.stringify(ast, null, 2));
}

inspect();
```

---

## Appendix B: Troubleshooting Common Issues

### B.1 Plugin Not Loading

Ensure the plugin is listed BEFORE prettier-plugin-apex in the plugins array, as
Prettier uses the first matching printer:

```json
{
	"plugins": ["prettier-plugin-apex-imo"]
}
```

Since our plugin re-exports everything from prettier-plugin-apex, you only need
to list ours.

### B.2 Printer Not Being Called

If your printer modifications aren't taking effect:

1. Verify the printer key matches (`apex`, not `apex-ast`)
2. Check that you're exporting `printers` correctly
3. Add logging to confirm the print function is invoked
4. Note: The AST node types are `NewObject$NewListLiteral`,
   `NewObject$NewSetLiteral`, and `NewObject$NewMapLiteral` (not the simpler
   `NewListInit`, etc.)

### B.3 Type Errors with prettier-plugin-apex

The apex plugin may not have complete TypeScript definitions. Use
`@ts-expect-error` or create a declarations file:

```typescript
// src/apex-plugin.d.ts
declare module 'prettier-plugin-apex' {
	import type { Plugin } from 'prettier';
	const plugin: Plugin;
	export = plugin;
}
```

### B.4 Test Failures Due to Apex Parser

Integration tests require the Apex parser. Options:

1. Use native executables (default on supported platforms)
2. Install Java 11+ for JVM-based parsing
3. Start the Apex server before running tests:

```bash
npx start-apex-server &
npm test
npx stop-apex-server
```

---

## ApexDoc {@code} Block Formatting

The plugin includes support for formatting code inside ApexDoc `{@code}` blocks.
This feature uses a preprocessor to format code snippets before the main parsing
and printing phase.

### Implementation Details

1. **Preprocessing**: The `preprocess` function in `src/index.ts` scans the
   original text for `{@code}` blocks within ApexDoc comments (`/** ... */`)

2. **Code Extraction**: Utility functions in `src/utils.ts`:
    - `findApexDocCodeBlocks()` - Locates all `{@code}` blocks in comments
    - `extractCodeFromBlock()` - Extracts code content, matching opening and
      closing braces
    - `formatCodeBlock()` - Formats extracted code using Prettier
    - `applyCommentIndentation()` - Applies proper indentation aligned with
      comment structure

3. **Indentation**: Code is indented to align with the opening bracket of
   `{@code` and maintains the `*` vertical alignment of the comment block

4. **Error Handling**: Invalid blocks (unmatched brackets or invalid Apex code)
   are preserved unchanged

### Example

**Before:**

```apex
/**
 * Example method.
 * {@code List<String> items = new List<String>{'a','b','c'}; }
 */
```

**After:**

```apex
/**
 * Example method.
 * {@code
 *   List<String> items = new List<String>{
 *     'a',
 *     'b',
 *     'c'
 *   };
 * }
 */
```

## Appendix C: Future Enhancement Ideas

If the core functionality works well, consider these additions:

1. **Threshold Configuration**: Allow users to set the minimum count (default 2)
   that triggers multiline
2. **Anonymous Apex Support**: Ensure the `apex-anonymous` parser works
   correctly
3. **SOQL/SOSL Lists**: Handle list literals in query contexts
4. **VSCode Extension**: Package as a VSCode extension for easier adoption
5. **Prettier 3.x Features**: Leverage `printPrettierIgnored()` for custom
   ignore handling

---

## Summary

This plan provides a complete blueprint for creating `prettier-plugin-apex-imo`:

- **Non-configurable**: Once installed, it just works
- **Minimal footprint**: Wraps existing plugin rather than forking
- **Well-tested**: Unit and integration tests with coverage targets
- **Production-ready**: CI/CD, security policy, proper documentation
- **TypeScript**: Full type safety with dual ESM/CJS exports

```

```
