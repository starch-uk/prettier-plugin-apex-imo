# prettier-plugin-apex-imo - Cursor Vibe Coding Plan

## Project Overview

**Repository:** `starch-uk/prettier-plugin-apex-imo`  
**Package Name:** `prettier-plugin-apex-imo`  
**Description:** An opinionated enhancement plugin for `prettier-plugin-apex` that enforces multiline formatting for Apex Lists and Maps with multiple entries.

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
- **Map literals** with 2+ entries → Always multiline

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
│   │   └── mixed/
│   │       ├── input.cls
│   │       └── output.cls
│   ├── printer.test.ts       # Printer unit tests
│   └── integration.test.ts   # End-to-end formatting tests
├── .github/
│   └── workflows/
│       ├── ci.yml            # CI pipeline
│       └── release.yml       # npm publish workflow
├── package.json
├── tsconfig.json
├── tsup.config.ts            # Build configuration
├── vitest.config.ts          # Test configuration
├── .prettierrc
├── .eslintrc.json
├── .gitignore
├── LICENSE                   # MIT License
├── README.md
├── SECURITY.md
└── CHANGELOG.md
```

---

## Phase 1: Project Initialization

### 1.1 Initialize npm Package

```bash
mkdir prettier-plugin-apex-imo
cd prettier-plugin-apex-imo
npm init -y
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
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:ci": "vitest run --coverage",
    "lint": "eslint src tests --ext .ts",
    "lint:fix": "eslint src tests --ext .ts --fix",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
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
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
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
  '@class': 'apex.jorje.data.ast.NewListInit' | 'apex.jorje.data.ast.NewSetInit';
  values: ApexNode[];
  [key: string]: unknown;
}

export interface ApexMapInitNode {
  '@class': 'apex.jorje.data.ast.NewMapInit';
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
    'apex-ast': ApexPrinter;
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
  return (
    node['@class'] === 'apex.jorje.data.ast.NewListInit' ||
    node['@class'] === 'apex.jorje.data.ast.NewSetInit'
  );
}

/**
 * Check if node is a Map literal initializer
 */
export function isMapInit(node: ApexNode): node is ApexMapInitNode {
  return node['@class'] === 'apex.jorje.data.ast.NewMapInit';
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
  originalPrint: () => Doc
): Doc {
  const node = path.node;

  // Only force multiline for 2+ entries
  if (!hasMultipleListEntries(node)) {
    return originalPrint();
  }

  // Force multiline: each entry on its own line
  const printedValues = path.map(print, 'values');

  return group([
    '{',
    indent([hardline, join([',', hardline], printedValues)]),
    hardline,
    '}',
  ]);
}

/**
 * Print a Map literal with forced multiline when 2+ entries
 */
function printMapInit(
  path: AstPath<ApexMapInitNode>,
  options: ParserOptions,
  print: PrintFn,
  originalPrint: () => Doc
): Doc {
  const node = path.node;

  // Only force multiline for 2+ entries
  if (!hasMultipleMapEntries(node)) {
    return originalPrint();
  }

  // Force multiline: each key-value pair on its own line
  const printedPairs = path.map((pairPath) => {
    return [
      pairPath.call(print, 'key'),
      ' => ',
      pairPath.call(print, 'value'),
    ];
  }, 'pairs');

  return group([
    '{',
    indent([hardline, join([',', hardline], printedPairs)]),
    hardline,
    '}',
  ]);
}

/**
 * Create a wrapped printer that intercepts List/Map literals
 */
export function createWrappedPrinter(originalPrinter: {
  print: (path: AstPath<ApexNode>, options: ParserOptions, print: PrintFn) => Doc;
}) {
  return {
    ...originalPrinter,
    print(
      path: AstPath<ApexNode>,
      options: ParserOptions,
      print: PrintFn
    ): Doc {
      const node = path.node;

      // Create a thunk for the original print behavior
      const originalPrint = () => originalPrinter.print(path, options, print);

      // Intercept List/Set literals
      if (isListInit(node)) {
        return printListInit(
          path as AstPath<ApexListInitNode>,
          options,
          print,
          originalPrint
        );
      }

      // Intercept Map literals
      if (isMapInit(node)) {
        return printMapInit(
          path as AstPath<ApexMapInitNode>,
          options,
          print,
          originalPrint
        );
      }

      // All other nodes: use original printer
      return originalPrint();
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
const originalPrinter = apexPlugin.printers?.['apex-ast'];

if (!originalPrinter) {
  throw new Error(
    'prettier-plugin-apex-imo requires prettier-plugin-apex to be installed. ' +
      'The apex-ast printer was not found.'
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
    'apex-ast': wrappedPrinter,
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
    it('should identify NewListInit nodes', () => {
      expect(isListInit({ '@class': 'apex.jorje.data.ast.NewListInit', values: [] })).toBe(true);
    });

    it('should identify NewSetInit nodes', () => {
      expect(isListInit({ '@class': 'apex.jorje.data.ast.NewSetInit', values: [] })).toBe(true);
    });

    it('should reject other node types', () => {
      expect(isListInit({ '@class': 'apex.jorje.data.ast.NewMapInit', pairs: [] })).toBe(false);
    });
  });

  describe('isMapInit', () => {
    it('should identify NewMapInit nodes', () => {
      expect(isMapInit({ '@class': 'apex.jorje.data.ast.NewMapInit', pairs: [] })).toBe(true);
    });

    it('should reject other node types', () => {
      expect(isMapInit({ '@class': 'apex.jorje.data.ast.NewListInit', values: [] })).toBe(false);
    });
  });

  describe('hasMultipleListEntries', () => {
    it('should return false for empty list', () => {
      expect(hasMultipleListEntries({ '@class': 'apex.jorje.data.ast.NewListInit', values: [] })).toBe(false);
    });

    it('should return false for single item', () => {
      expect(hasMultipleListEntries({
        '@class': 'apex.jorje.data.ast.NewListInit',
        values: [{ '@class': 'apex.jorje.data.ast.LiteralExpr' }],
      })).toBe(false);
    });

    it('should return true for 2+ items', () => {
      expect(hasMultipleListEntries({
        '@class': 'apex.jorje.data.ast.NewListInit',
        values: [
          { '@class': 'apex.jorje.data.ast.LiteralExpr' },
          { '@class': 'apex.jorje.data.ast.LiteralExpr' },
        ],
      })).toBe(true);
    });
  });

  describe('hasMultipleMapEntries', () => {
    it('should return false for empty map', () => {
      expect(hasMultipleMapEntries({ '@class': 'apex.jorje.data.ast.NewMapInit', pairs: [] })).toBe(false);
    });

    it('should return false for single pair', () => {
      expect(hasMultipleMapEntries({
        '@class': 'apex.jorje.data.ast.NewMapInit',
        pairs: [{
          '@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
          key: { '@class': 'apex.jorje.data.ast.LiteralExpr' },
          value: { '@class': 'apex.jorje.data.ast.LiteralExpr' },
        }],
      })).toBe(false);
    });

    it('should return true for 2+ pairs', () => {
      expect(hasMultipleMapEntries({
        '@class': 'apex.jorje.data.ast.NewMapInit',
        pairs: [
          {
            '@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
            key: { '@class': 'apex.jorje.data.ast.LiteralExpr' },
            value: { '@class': 'apex.jorje.data.ast.LiteralExpr' },
          },
          {
            '@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
            key: { '@class': 'apex.jorje.data.ast.LiteralExpr' },
            value: { '@class': 'apex.jorje.data.ast.LiteralExpr' },
          },
        ],
      })).toBe(true);
    });
  });

  describe('shouldForceMultiline', () => {
    it('should return true for list with multiple entries', () => {
      expect(shouldForceMultiline({
        '@class': 'apex.jorje.data.ast.NewListInit',
        values: [
          { '@class': 'apex.jorje.data.ast.LiteralExpr' },
          { '@class': 'apex.jorje.data.ast.LiteralExpr' },
        ],
      })).toBe(true);
    });

    it('should return true for map with multiple entries', () => {
      expect(shouldForceMultiline({
        '@class': 'apex.jorje.data.ast.NewMapInit',
        pairs: [
          {
            '@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
            key: { '@class': 'apex.jorje.data.ast.LiteralExpr' },
            value: { '@class': 'apex.jorje.data.ast.LiteralExpr' },
          },
          {
            '@class': 'apex.jorje.data.ast.MapLiteralKeyValue',
            key: { '@class': 'apex.jorje.data.ast.LiteralExpr' },
            value: { '@class': 'apex.jorje.data.ast.LiteralExpr' },
          },
        ],
      })).toBe(true);
    });

    it('should return false for other nodes', () => {
      expect(shouldForceMultiline({ '@class': 'apex.jorje.data.ast.MethodDecl' })).toBe(false);
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
  const fixturePath = path.join(__dirname, '__fixtures__', name, `${file}.cls`);
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

```markdown
# prettier-plugin-apex-imo

[![npm version](https://img.shields.io/npm/v/prettier-plugin-apex-imo.svg)](https://www.npmjs.com/package/prettier-plugin-apex-imo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/starch-uk/prettier-plugin-apex-imo/actions/workflows/ci.yml/badge.svg)](https://github.com/starch-uk/prettier-plugin-apex-imo/actions/workflows/ci.yml)

> **IMO** = In My Opinion — because Prettier is opinionated, and so am I.

An opinionated enhancement for [prettier-plugin-apex](https://github.com/dangmai/prettier-plugin-apex) that enforces multiline formatting for Apex Lists and Maps with multiple entries.

## The Problem

When using `prettier-plugin-apex`, code like this:

```apex
final String expectedJson = String.join(new List<String>{
  '{',
  '  "tags" : [ "reading", "gaming", "coding" ]',
  '}'
}, '\n');
```

Gets reformatted to a single line, defeating the purpose of readable formatting.

## The Solution

This plugin wraps `prettier-plugin-apex` and modifies the printing behaviour:

- **List literals** with 2+ entries → Always multiline
- **Map literals** with 2+ entries → Always multiline
- **Set literals** with 2+ entries → Always multiline

This is **non-configurable** behaviour. Once installed, it just works.

## Installation

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

That's it! The plugin automatically includes `prettier-plugin-apex`, so you only need to specify this one.

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

Prettier has a strict [option philosophy](https://prettier.io/docs/option-philosophy) that discourages adding new formatting options. While I respect this philosophy, I believe the current behaviour for multi-item Lists and Maps is suboptimal for code readability.

Rather than fork `prettier-plugin-apex` or maintain options, this plugin provides a simple, opinionated wrapper that enforces the behaviour I (and hopefully others) prefer.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Security

For security issues, please email security@starch.uk. See [SECURITY.md](SECURITY.md) for details.

## License

MIT © Starch UK

## Acknowledgements

- [prettier-plugin-apex](https://github.com/dangmai/prettier-plugin-apex) by Dang Mai
- [Prettier](https://prettier.io/) for the amazing formatting engine
```

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
```

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
        node-version: [20, 22]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

      - name: Test
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: matrix.node-version == 20
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
      - uses: actions/checkout@v4

      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm run test:ci

      - name: Publish to npm
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
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
  "printWidth": 100,
  "tabWidth": 2
}
```

### 6.3 .eslintrc.json

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  },
  "env": {
    "node": true,
    "es2022": true
  }
}
```

### 6.4 CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

1. **AST Node Types**: The exact `@class` values need to be verified against the actual `prettier-plugin-apex` AST. The values used in this plan are educated guesses based on the jorje parser naming conventions.

2. **Printer Wrapping Strategy**: The approach of wrapping the original printer and selectively intercepting specific node types is the cleanest way to extend functionality without forking.

3. **Doc Builders**: The `hardline` builder is used to force line breaks. This is different from `line` which allows Prettier to decide.

4. **Testing with Apex Parser**: Integration tests require the Apex parser to be available. If running on a platform without native executables, Java 11+ is required.

5. **Edge Cases to Consider**:
   - Nested structures (Map containing Lists)
   - Very long single-item values that might wrap
   - Comments within List/Map literals
   - Trailing commas

### Cursor Prompts for Each Phase

**Phase 1:**
> "Initialize a new TypeScript npm package for a Prettier plugin called prettier-plugin-apex-imo. Set up tsup for building, vitest for testing, and configure ESM + CJS dual exports."

**Phase 2:**
> "Implement the core plugin logic that wraps prettier-plugin-apex and overrides the printer for List and Map literals to force multiline when there are 2+ entries. Use the Prettier doc builders."

**Phase 3:**
> "Create comprehensive tests including unit tests for utility functions and integration tests that use Prettier to format actual Apex code fixtures."

**Phase 4:**
> "Write the README, SECURITY.md, and LICENSE files for the package."

**Phase 5:**
> "Set up GitHub Actions CI/CD with test, build, and npm publish workflows."

---

## Appendix A: Discovering Exact AST Node Types

The plan uses educated guesses for AST node class names. Before implementation, verify the exact node types using these techniques:

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

| Apex Construct | Likely `@class` Value |
|----------------|----------------------|
| List literal `new List<T>{ }` | `apex.jorje.data.ast.NewListInit` |
| Set literal `new Set<T>{ }` | `apex.jorje.data.ast.NewSetInit` |
| Map literal `new Map<K,V>{ }` | `apex.jorje.data.ast.NewMapInit` |
| Map key-value pair | `apex.jorje.data.ast.MapLiteralKeyValue` |

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

Ensure the plugin is listed BEFORE prettier-plugin-apex in the plugins array, as Prettier uses the first matching printer:

```json
{
  "plugins": ["prettier-plugin-apex-imo"]
}
```

Since our plugin re-exports everything from prettier-plugin-apex, you only need to list ours.

### B.2 Printer Not Being Called

If your printer modifications aren't taking effect:
1. Verify the `astFormat` matches (`apex-ast`)
2. Check that you're exporting `printers` correctly
3. Add logging to confirm the print function is invoked

### B.3 Type Errors with prettier-plugin-apex

The apex plugin may not have complete TypeScript definitions. Use `@ts-expect-error` or create a declarations file:

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

## Appendix C: Future Enhancement Ideas

If the core functionality works well, consider these additions:

1. **Threshold Configuration**: Allow users to set the minimum count (default 2) that triggers multiline
2. **Anonymous Apex Support**: Ensure the `apex-anonymous` parser works correctly
3. **SOQL/SOSL Lists**: Handle list literals in query contexts
4. **VSCode Extension**: Package as a VSCode extension for easier adoption
5. **Prettier 3.x Features**: Leverage `printPrettierIgnored()` for custom ignore handling

---

## Summary

This plan provides a complete blueprint for creating `prettier-plugin-apex-imo`:

- **Non-configurable**: Once installed, it just works
- **Minimal footprint**: Wraps existing plugin rather than forking
- **Well-tested**: Unit and integration tests with coverage targets
- **Production-ready**: CI/CD, security policy, proper documentation
- **TypeScript**: Full type safety with dual ESM/CJS exports
```
