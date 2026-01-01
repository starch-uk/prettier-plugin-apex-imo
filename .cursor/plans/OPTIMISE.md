# Code Optimization Plan

## Quick Reference Checklist

Before starting optimization:

- [ ] Read this entire plan
- [ ] Understand the codebase structure
- [ ] Have tests passing
- [ ] Have linting passing

During optimization:

- [ ] Fix linting after each significant change
- [ ] Re-check linting after fixes (may need multiple iterations)
- [ ] Run tests after each file
- [ ] Document non-obvious changes

After optimization:

- [ ] All tests pass
- [ ] Zero linting errors or warnings
- [ ] Code is formatted
- [ ] Functionality preserved

## Objective

Aggressively refactor all source files to reduce code size, increase reliance on
Prettier base and `prettier-plugin-apex` (which extends Prettier base), and
optimize the codebase while maintaining all functionality.

## Target Files

All TypeScript files in the `src/` directory:

- `src/*.ts` - All TypeScript files in the root of `src/`

### Reference Files (`src/refs/*.ts`)

Files in `src/refs/*.ts` are **reference data files** that contain lookup tables
and reference data:

- **Methods and utility functions** in these files are fair game for
  optimization
- **Lookup data** (objects, maps, arrays containing reference data) **must
  remain unchanged**
- Examples of reference files:
    - `src/refs/apex-annotations.ts`
    - `src/refs/standard-objects.ts`
    - `src/refs/apex-reserved-words.ts`
    - etc.

### Test Files (`test/*.test.ts`)

All Vitest test files in the `test/` directory:

- `test/*.test.ts` — All test files

**CRITICAL:** When optimizing tests, **always consult `docs/VITEST.md`** for
Vitest-specific guidance, best practices, and reference information.

**Test Optimization Rules:**

- **DO:** Optimise test code structure and readability
- **DO:** Improve test descriptions to be accurate and informative
- **DO:** Apply the same TypeScript best practices as source files
- **DO:** Consolidate duplicate test setup/teardown logic
- **DO:** Use Vitest's features effectively, including appropriate use of
  `.concurrent` for independent tests that can run in parallel
- **DO:** Ensure tests are in the correct test file based on what they're
  testing (e.g., tests for `annotations.ts` should be in
  `tests/annotations.test.ts` or similar)
- **DO:** Use `__fixtures__` directories for test fixtures instead of hardcoding
  string literals for input/output expectations
- **DO NOT:** Remove any tests
- **DO NOT:** Change test fixtures or expected outputs
- **DO NOT:** Alter what is being tested (only how it's structured)
- **DO NOT:** Hardcode string literals for test input/output - use fixtures from
  `__fixtures__` directories

## Pre-Optimization Analysis

Before starting optimizations, analyze the codebase to identify:

- **Code organization issues** in `src/*.ts` files (excluding `src/refs/*.ts`) -
  ensure functions, types, and utilities are in the correct files based on their
  purpose and logical grouping
- **Test organization issues** in `tests/*.test.ts` files - ensure tests are in
  the correct test file based on what they're testing (e.g., tests for
  `annotations.ts` should be in `tests/annotations.test.ts` or similar)
- **Hardcoded test fixtures** - identify tests that hardcode string literals for
  input/output expectations instead of using fixtures from `__fixtures__`
  directories
- **Opportunities for concurrent tests** - identify independent tests that could
  benefit from `.concurrent` to improve execution speed, or identify tests
  incorrectly marked as concurrent that share state or have dependencies
- **Hardcoded constants that could use Prettier/prettier-plugin-apex values** -
  identify hardcoded constants, strings, or values that could be replaced with
  existing constants or functions from Prettier or prettier-plugin-apex
- **Unused exports** that should be removed (check all `export` statements
  against actual imports across the codebase)
- **Magic numbers** that should be extracted as named constants (or replaced
  with Prettier/prettier-plugin-apex constants if available)
- **Duplicate patterns** (type guards, validation checks, etc.) that can be
  consolidated
- **Redundant checks** (e.g., `Array.isArray()` when types guarantee arrays)
- **Interface duplication** that can use utility types (`Readonly<T>`)
- **Complex conditionals** that can be simplified or extracted to helper
  functions
- **String operations** that could be optimized or cached
- **Type assertions** that could be replaced with proper type guards
- **Opportunities to extract helper functions** from complex logic
- **Repeated calculations** that could be cached
- **Repeated property access** that could be cached (e.g., `node['@class']`)
- **Missing `const` assertions** for literal type inference
- **Opportunities for discriminated unions** over type assertions
- **Places where `satisfies` operator** could validate without widening
- **Outdated or inaccurate comments** that should be updated or removed

## Optimization Strategy

### Primary Goal

**Aggressively refactor the target files to:**

- Reduce code size
- Rely on Prettier base and `prettier-plugin-apex` more (delegate formatting
  where possible)
- Optimize for performance and maintainability

### Iterative Process

This optimization should be performed **repeatedly** after every pass until no
more optimizations can be performed. Continue iterating until:

1. No further code size reduction is possible without compromising functionality
2. All opportunities to delegate to Prettier base and `prettier-plugin-apex`
   have been exhausted
3. All logical optimizations have been applied

### Optimization Techniques

Apply the following techniques aggressively:

**IMPORTANT: Focus on actual code optimizations, not formatting**

- **Do NOT** just condense code to reduce line counts - Prettier will reformat
  it anyway
- **Focus on** reducing complexity, removing redundant logic, improving
  algorithms, and eliminating unnecessary code
- **Optimize for** maintainability, performance, and logical simplicity
- Line count reduction is a side effect of real optimizations, not the goal
  itself

1. **Code Size Reduction (Logical, Not Formatting)**
    - **Verify code organization** - ensure code in `src/*.ts` files (excluding
      `src/refs/*.ts`) is in the correct file based on purpose and logical
      grouping (e.g., annotation-related code in `annotations.ts`,
      collection-related code in `collections.ts`)
    - **Remove unused exports** - check all exported functions, types, and
      constants against actual imports across the entire codebase (including
      tests)
    - Merge similar functions that duplicate logic
    - Inline single-use variables that don't improve readability
    - Combine conditional logic that can be simplified
    - Simplify control flow by removing unnecessary branches
    - Remove redundant checks and validations
    - Reduce nesting levels through early returns and guard clauses
    - Eliminate dead code and unused variables
    - **Update or remove outdated comments** - ensure all comments accurately
      reflect the current code behavior
    - **Prefer AST manipulation over regex** (see AST vs Regex section below)
    - **Do NOT** just put multiple statements on one line - Prettier will
      reformat
    - **Fix linting issues immediately** after each optimization change

2. **Functional Style**
    - Convert regular functions to arrow functions where appropriate
    - Use functional programming patterns (map, filter, reduce, some, etc.)
    - Prefer immutable operations
    - Use spread operators for object/array operations

3. **Delegation to Prettier base and prettier-plugin-apex**
    - **Prefer Prettier and prettier-plugin-apex constants/functions over
      hardcoded values** - use existing constants, utilities, and functions from
      these libraries instead of hardcoding values (e.g., use Prettier's
      built-in constants for formatting options, use prettier-plugin-apex
      utilities for AST manipulation)
    - Identify areas where Prettier base can handle formatting (Prettier is the
      foundation/core)
    - Identify areas where `prettier-plugin-apex` can handle formatting (it
      extends Prettier base as a plugin)
    - Reduce custom formatting logic where possible
    - Leverage existing Prettier base utilities and printer functionality
    - Use Prettier base's built-in formatting capabilities instead of
      reimplementing
    - Delegate to `prettier-plugin-apex` where it already provides the needed
      functionality
    - Work with AST nodes from the parser rather than text manipulation

4. **Type Safety**
    - Maintain strict TypeScript typing
    - Use type guards effectively
    - Minimize type assertions
    - **Replace type assertions with type guards** where possible
    - **Use utility types** (`Readonly<T>`, `Partial<T>`, etc.) to reduce
      duplication
    - **Leverage TypeScript's type narrowing** instead of runtime checks when
      types guarantee structure
    - **Remove redundant runtime checks** when TypeScript types already
      guarantee the condition
    - **Fix nullable conditionals** - use explicit null/undefined checks
    - **Fix unsafe assignments** - add proper type guards
    - **Fix unnecessary type assertions** - use proper type narrowing
    - **Add Readonly<T> to parameters** - especially in tests and utility
      functions

5. **AST Manipulation (Preferred Approach)**
    - **AST manipulation is strongly preferred over regex-based text
      processing**
    - Work with the Abstract Syntax Tree provided by `prettier-plugin-apex`
      parser
    - Manipulate AST nodes directly rather than using regex to modify source
      text
    - Benefits: More reliable, handles edge cases better, respects code
      structure
    - **When regex is acceptable:**
        - Preprocessing text before parsing (e.g., annotation normalization
          before AST creation)
        - Simple string replacements that don't affect code structure
        - Comment/documentation processing where AST doesn't include comments
    - **Document regex usage:** If regex must be used, add a comment explaining
      why AST manipulation isn't feasible
    - When regex is necessary, prefer AST manipulation after parsing when
      possible

6. **ESLint Disable Comments (Minimize and Scope Appropriately)**
    - **Use ESLint disable comments as little as possible** - prefer fixing the
      underlying issue
    - **Keep scope as small as possible within reason** - use inline comments
      for single lines when possible
    - **Scope escalation rules:**
        - If the same lint rule needs 2+ disable comments in the same function →
          scope at function level
        - If the same lint rule needs 2+ disable comments in the same file →
          scope at file level
        - Apply this pattern at higher levels (directory, project) if needed
    - **Example progression:**
        - Single line: `// eslint-disable-next-line rule-name`
        - Multiple lines in function: `/* eslint-disable rule-name */` at
          function start, `/* eslint-enable rule-name */` at end
        - Multiple occurrences in file: `/* eslint-disable rule-name */` at top
          of file
    - Always prefer fixing the code over disabling rules when feasible

7. **Performance**
    - Optimize loops and iterations
    - Reduce unnecessary computations
    - Cache repeated calculations where beneficial
    - **Cache repeated property access** (e.g., `node['@class']` accessed
      multiple times)
    - **Use early returns** to avoid unnecessary processing
    - **Minimize string operations** in hot paths
    - **Consider algorithmic complexity** when optimizing loops

8. **Code Pattern Optimization**
    - **Prefer Prettier/prettier-plugin-apex constants over hardcoded values** -
      check if Prettier or prettier-plugin-apex already provides a constant or
      function before creating a new one
    - Extract magic numbers to named constants (e.g., `CODE_TAG_LENGTH = 6`)
      only if not available from Prettier/prettier-plugin-apex
    - **For array indices and string positions:** Extract as constants if used
      multiple times, or disable with justification for single-use cases
    - Consolidate duplicate type guard patterns into reusable helpers
    - Use utility types to reduce interface duplication
      (`type ReadonlyCodeBlock = Readonly<CodeBlock>`)
    - Remove redundant type checks when TypeScript types guarantee the structure
    - Extract complex conditionals into well-named helper functions
    - Replace multiple string operations with single operations where possible
    - Cache repeated property access or calculations
    - Use more efficient data structures where appropriate
    - **Fix all linting issues** as part of pattern optimization

9. **Helper Function Extraction**
    - Extract complex conditionals into well-named boolean functions
    - Extract repeated patterns into reusable utilities
    - Extract magic number calculations into named functions
    - Keep helper functions pure (no side effects) when possible
    - Prefer small, focused helpers over large, multi-purpose functions

## Common Optimization Patterns in This Codebase

Based on actual optimization passes, here are patterns frequently found:

### Consolidating Repetitive Error Messages

```typescript
// ❌ Before
if (!condition1) throw new Error('Same message');
if (!condition2) throw new Error('Same message');
if (!condition3) throw new Error('Same message');

// ✅ After
const ERROR_MESSAGE = 'Same message';
if (!condition1 || !condition2 || !condition3) throw new Error(ERROR_MESSAGE);
```

### Caching Repeated Property Access

```typescript
// ❌ Before
if (node['@class'] === 'Type1' || node['@class'] === 'Type2') { ... }

// ✅ After
const nodeClass = getNodeClass(node);
if (nodeClass === 'Type1' || nodeClass === 'Type2') { ... }
```

### Simplifying Conditional Returns

```typescript
// ❌ Before - multiple early returns
function shouldNormalize(params) {
	if (params.forceTypeContext) return true;
	if (params.parentKey === 'types') return true;
	if (params.key === 'names') return true;
	return isInTypeContext(params.path);
}

// ✅ After - single return with logical OR (when all branches return boolean)
function shouldNormalize(params) {
	return (
		params.forceTypeContext ||
		params.parentKey === 'types' ||
		params.key === 'names' ||
		isInTypeContext(params.path)
	);
}
```

**Guideline:** Use logical operators in return statements when:

- All branches return the same type (boolean, string, etc.)
- The logic is straightforward (no side effects)
- It improves readability

Use early returns when:

- Branches return different types
- Early exit improves performance (guard clauses)
- The logic is complex enough that early returns aid clarity

### Extracting Repeated Calculations

```typescript
// ❌ Before
codeLines.push(createIndent(getIndentLevel(line, tabWidth) - methodIndent - tabWidth, ...));
// ... later ...
codeLines.push(createIndent(getIndentLevel(line, tabWidth) - methodIndent - tabWidth, ...));

// ✅ After
const lineIndent = getIndentLevel(line, tabWidth);
codeLines.push(createIndent(lineIndent - methodIndent - tabWidth, ...));
// ... later ...
codeLines.push(createIndent(lineIndent - methodIndent - tabWidth, ...));
```

### Caching Function-Scope Computations

Cache repeated calculations within a function scope, especially when:

- The calculation is used multiple times in the same function
- The calculation involves function calls or property access
- The calculation is used in different code paths

```typescript
// ❌ Before - repeated calculation
export const applyCommentIndentation = (formattedCode, codeBlock, options) => {
  const { tabWidth, useTabs } = options;
  const { commentIndent } = codeBlock;
  return lines.map((line) =>
    line.trim() === ''
      ? createIndent(commentIndent, tabWidth, useTabs) + ' *'
      : createIndent(commentIndent, tabWidth, useTabs) + ' * ' + ...
  );
};

// ✅ After - cached computation
export const applyCommentIndentation = (formattedCode, codeBlock, options) => {
  const { tabWidth, useTabs } = options;
  const { commentIndent } = codeBlock;
  const baseIndent = createIndent(commentIndent, tabWidth, useTabs); // Cache once
  const commentPrefix = baseIndent + ' * ';
  return lines.map((line) =>
    line.trim() === ''
      ? baseIndent + ' *'
      : commentPrefix + ...
  );
};
```

### Simplifying Complex Boolean Expressions

Extract complex boolean conditions and use early returns when they improve
readability:

```typescript
// ❌ Before - nested boolean logic
const shouldForceMultiline = (normalizedName, formattedParams) => {
  return (
    INVOCABLE_ANNOTATIONS.includes(normalizedName.toLowerCase()) &&
    (formattedParams.length > MIN_PARAMS_FOR_MULTILINE ||
     formattedParams.some(...))
  );
};

// ✅ After - early return for clarity
const shouldForceMultiline = (normalizedName, formattedParams) => {
  const normalizedNameLower = normalizedName.toLowerCase();
  if (!INVOCABLE_ANNOTATIONS.includes(normalizedNameLower)) return false;
  return (
    formattedParams.length > MIN_PARAMS_FOR_MULTILINE ||
    formattedParams.some(...)
  );
};
```

**Guideline:** When a boolean expression has multiple conditions with different
semantic meaning, consider extracting early returns to make the logic clearer,
even if it doesn't reduce the overall line count.

### Consolidating Multiple Early Returns

```typescript
// ❌ Before
if (condition1) return true;
if (condition2) return true;
if (condition3) return true;
return false;

// ✅ After
return condition1 || condition2 || condition3;
```

## TypeScript Best Practices

### Type-Level Programming

Use modern TypeScript features for better type safety and inference:

```typescript
// Use `const` assertions for literal types
const OPERATORS = ['==', '!=', '==='] as const;
type Operator = (typeof OPERATORS)[number];

// Discriminated unions over type assertions
type ASTNode =
	| { kind: 'class'; name: string; members: Member[] }
	| { kind: 'method'; name: string; params: Param[] };

// Template literal types for string manipulation
type EventName<T extends string> = `on${Capitalize<T>}`;

// Branded types for domain safety
type NodeId = string & { readonly __brand: unique symbol };
```

### Modern TypeScript Patterns

Leverage the latest TypeScript features:

- **`satisfies` operator** — validates type without widening:

    ```typescript
    const config = {
    	indent: 2,
    	printWidth: 80,
    } satisfies PrinterOptions;
    ```

- **`using` declarations** for deterministic cleanup:

    ```typescript
    using resource = acquireResource();
    // automatically disposed at end of scope
    ```

- **`NoInfer<T>`** to prevent unwanted type inference in generics

- **`const` type parameters** for literal inference:
    ```typescript
    const createNode = <const T extends string>(type: T) => ({ type });
    // Returns { type: "class" } not { type: string }
    ```

### Performance-Specific TypeScript Patterns

- **Avoid excessive union types** — large unions slow the compiler
- **Use `interface` over `type` for object shapes** — better performance and
  error messages
- **Leverage `readonly` arrays/tuples** — enables optimizations, prevents
  mutation
- **Use `Map`/`Set` over object literals** for dynamic keys — O(1) lookups
- **Prefer `includes()` with `as const` arrays** over switch/if chains

### Type Guard Consolidation

Create reusable, composable type guards:

```typescript
// Generic type guard factory
const isNodeOfClass =
	<T extends string>(className: T) =>
	(node: ASTNode): node is Extract<ASTNode, { '@class': T }> =>
		node['@class'] === className;

// Compose guards
const isClassOrInterface = or(
	isNodeOfClass('Class'),
	isNodeOfClass('Interface'),
);
```

### Module Organisation

- **Barrel exports** (`index.ts`) for clean APIs, but avoid deep re-exports
- **Explicit `type` imports/exports** — use `import type` and `export type`
- **Isolate side effects** — keep modules pure where possible
- **Co-locate types with implementation** — avoid separate `types.ts` unless
  shared

### Error Handling

- Use **discriminated union results** over exceptions for expected failures:
    ```typescript
    type Result<T, E = Error> =
    	| { ok: true; value: T }
    	| { ok: false; error: E };
    ```
- Reserve exceptions for truly exceptional situations
- Use `never` return type for exhaustiveness checking

### AST Best Practices

- **Use `Visitor` pattern** with type-safe node handlers
- **Leverage `prettier-plugin-apex`'s existing type definitions**
- **Memoize expensive AST traversals** — WeakMap keyed by node reference
- **Prefer iterative over recursive traversal** for deep trees (stack safety)

### Documentation-as-Code

- Use `@example` tags for complex functions
- Use `@see` to reference related functions
- Use `@internal` to mark non-public APIs
- Enable `declaration` + `declarationMap` for jump-to-source

## Vitest Best Practices

**IMPORTANT:** Before optimizing tests, **read `docs/VITEST.md`** in full. This
document contains comprehensive Vitest reference information, best practices,
and project-specific guidance that should be followed when optimizing test
files.

### Descriptive Test Names

Use the pattern: `it('<action> <subject> <condition/context>')`

```typescript
// ❌ Vague
it('works', () => {
	/* ... */
});
it('handles edge case', () => {
	/* ... */
});

// ✅ Descriptive - state what's being tested and expected outcome
it('formats class declaration with single method', () => {
	/* ... */
});
it('preserves inline comments when apexInsertFinalNewline is false', () => {
	/* ... */
});
```

### Test Organisation with `describe` Blocks

```typescript
describe('AnnotationPrinter', () => {
	describe('formatAnnotation', () => {
		describe('with parameters', () => {
			it('formats single parameter inline', () => {
				/* ... */
			});
			it('formats multiple parameters on separate lines', () => {
				/* ... */
			});
		});

		describe('without parameters', () => {
			it('omits parentheses for marker annotations', () => {
				/* ... */
			});
		});
	});
});
```

### Use `it.each` or `it.for` for Parameterised Tests

```typescript
// ❌ Repetitive
it('formats == operator', () => expect(format('==')).toBe('=='));
it('formats != operator', () => expect(format('!=')).toBe('!='));
it('formats === operator', () => expect(format('===')).toBe('==='));

// ✅ Parameterised with it.each
it.each(['==', '!=', '==='])('formats %s operator correctly', (op) => {
	expect(format(op)).toBe(op);
});

// ✅ With named parameters for complex cases
it.each([
	{
		input: 'class Foo{}',
		expected: 'class Foo {}',
		desc: 'class declaration',
	},
	{
		input: 'interface Bar{}',
		expected: 'interface Bar {}',
		desc: 'interface declaration',
	},
])('formats $desc correctly', ({ input, expected }) => {
	expect(format(input)).toBe(expected);
});

// ✅ Use it.for for concurrent tests (parallel-safe alternative to it.each)
it.concurrent.for([
	{ input: 'class Foo{}', expected: 'class Foo {}' },
	{ input: 'interface Bar{}', expected: 'interface Bar {}' },
])('formats $input correctly', async ({ input, expected }, { expect }) => {
	// Note: must use expect from test context for concurrent tests
	expect(format(input)).toBe(expected);
});
```

### Leverage Vitest's Built-in Matchers

```typescript
// ✅ Use specific matchers
expect(result).toMatchSnapshot();
expect(result).toMatchInlineSnapshot(`"formatted output"`);
expect(fn).toHaveBeenCalledOnce();
expect(fn).toHaveBeenCalledWith(expect.objectContaining({ type: 'class' }));
expect(array).toHaveLength(3);
expect(result).toContain('substring');

// ✅ Use asymmetric matchers
expect(node).toEqual(
	expect.objectContaining({
		'@class': 'ClassDeclaration',
		name: expect.any(String),
	}),
);

// ✅ Use toSatisfy for custom predicates
expect(result).toSatisfy((value) => value.startsWith('class'));

// ✅ Use file snapshots for large outputs
expect(largeOutput).toMatchFileSnapshot('./snapshots/large-output.txt');
```

### Soft Assertions and Polling

````typescript
// ✅ Use soft assertions to check multiple things without stopping
it("validates node structure", () => {
  expect.soft(node.type).toBe("class");
  expect.soft(node.name).toBeDefined();
  expect.soft(node.members).toHaveLength(3);
  // All assertions run even if earlier ones fail
});

// ✅ Use polling for async assertions
it("eventually formats correctly", async () => {
  await expect.poll(() => getResult()).toBe("formatted");
  // Or with options:
  await expect
    .poll(() => getResult(), { interval: 100, timeout: 5000 })
    .toContain("class");
});

### Setup and Teardown Consolidation

```typescript
// ✅ Use beforeEach/afterEach for repeated setup
describe("Printer", () => {
  let printer: Printer;

  beforeEach(() => {
    printer = createPrinter(defaultOptions);
  });

  // tests...
});

// ✅ Use beforeAll for expensive one-time setup
describe("Parser integration", () => {
  let parsedFixtures: Map<string, AST>;

  beforeAll(async () => {
    parsedFixtures = await loadAndParseFixtures();
  });

  // tests...
});
````

### Type-Safe Test Utilities

```typescript
// ✅ Create typed test helpers
const createTestNode = <T extends ASTNode['@class']>(
	type: T,
	overrides?: Partial<Extract<ASTNode, { '@class': T }>>,
): Extract<ASTNode, { '@class': T }> => ({
	'@class': type,
	...defaultsForType(type),
	...overrides,
});

// ✅ Use satisfies in test data
const testOptions = {
	printWidth: 80,
	tabWidth: 2,
} satisfies Partial<PrinterOptions>;
```

### Test Fixtures with `test.extend`

Use fixture injection for DRY, reusable test setup:

````typescript
// ✅ Define reusable fixtures
const test = baseTest.extend<{
  printer: Printer;
  defaultOptions: PrinterOptions;
}>({
  defaultOptions: async ({}, use) => {
    await use({ printWidth: 80, tabWidth: 2 });
  },
  printer: async ({ defaultOptions }, use) => {
    const printer = createPrinter(defaultOptions);
    await use(printer);
    // cleanup runs after test
  },
});

// ✅ Use fixtures in tests - automatically injected
test("formats class declaration", ({ printer, expect }) => {
  expect(printer.print(classNode)).toMatchSnapshot();
});

// ✅ Fixtures can depend on other fixtures
test("uses custom options", ({ printer }) => {
  // printer was created with defaultOptions fixture
});

### Concurrent Tests (When Safe)

**CRITICAL:** Consider appropriate use of `.concurrent` when optimizing tests. Concurrent tests can significantly improve test execution speed, but should only be used when tests are truly independent.

**When to use `.concurrent`:**
- Tests are independent (no shared state, no dependencies between tests)
- Tests don't modify global state or external resources
- Tests are I/O-bound or CPU-bound and can benefit from parallelization
- Tests use fixtures or test context properly (no shared mutable state)

**When NOT to use `.concurrent`:**
- Tests share mutable state or depend on execution order
- Tests modify global state, environment variables, or external resources
- Tests use shared resources that aren't thread-safe
- Tests have interdependencies (one test's output affects another)

```typescript
// ✅ Run independent tests concurrently
describe.concurrent("format", () => {
  it("formats classes", async ({ expect }) => {
    // Note: use expect from context for concurrent tests
    expect(format("class Foo{}")).toBe("class Foo {}");
  });
  it("formats interfaces", async ({ expect }) => {
    expect(format("interface Bar{}")).toBe("interface Bar {}");
  });
});

// ✅ Individual test can be concurrent
it.concurrent("formats annotation", async ({ expect }) => {
  expect(format("@Test")).toBe("@Test");
});

// ❌ DON'T use concurrent if tests share state
let sharedCounter = 0;
describe.concurrent("bad example", () => {
  it("increments", () => {
    sharedCounter++; // ❌ Shared mutable state
  });
  it("checks value", () => {
    expect(sharedCounter).toBe(1); // ❌ Depends on execution order
  });
});

// Or at file level in vitest.config.ts
````

### Test Lifecycle Hooks

```typescript
// ✅ Use onTestFinished for cleanup that depends on test outcome
it('creates temporary files', async ({ onTestFinished }) => {
	const tempFile = await createTempFile();

	onTestFinished(async () => {
		await cleanupTempFile(tempFile);
	});

	// test logic...
});

// ✅ Use onTestFailed for failure-specific actions
it('complex operation', async ({ onTestFailed }) => {
	onTestFailed((result) => {
		console.log('Failed with:', result.errors);
		// Could save debug info, screenshots, etc.
	});

	// test logic...
});
```

### Special Test Modifiers

```typescript
// ✅ Use test.fails for tests expected to fail (useful during development)
test.fails('known bug - issue #123', () => {
	// This test is expected to fail; it will pass when the assertion fails
	expect(brokenFunction()).toBe('correct');
});

// ✅ Use skipIf/runIf for conditional tests
test.skipIf(process.env.CI)('skipped in CI', () => {
	/* ... */
});
test.runIf(process.platform === 'linux')('linux only', () => {
	/* ... */
});

// ✅ Use test.todo as placeholder
test.todo('implement this feature');
```

### Async Utilities

```typescript
// ✅ Use vi.waitFor for polling conditions
it('waits for condition', async () => {
	await vi.waitFor(() => {
		expect(getStatus()).toBe('ready');
	});
});

// ✅ Use vi.waitUntil for async predicates
it('waits until ready', async () => {
	await vi.waitUntil(() => isReady(), { timeout: 5000, interval: 100 });
});

// ✅ Use vi.dynamicImportSettled for dynamic imports
it('handles dynamic imports', async () => {
	triggerDynamicImport();
	await vi.dynamicImportSettled(); // wait for all dynamic imports to resolve
	expect(getLoadedModules()).toHaveLength(3);
});
```

### Inline Snapshots for Small Outputs

```typescript
// ✅ Inline snapshots for small, readable outputs
it('formats simple class', () => {
	expect(format('class Foo{}')).toMatchInlineSnapshot(`
    "class Foo {
    }"
  `);
});

// ✅ External snapshots for large outputs
it('formats complex class with multiple members', () => {
	expect(format(complexInput)).toMatchSnapshot();
});
```

### Test Fixtures

**CRITICAL:** Use `__fixtures__` directories for test fixtures instead of
hardcoding string literals for input/output expectations.

```typescript
// ❌ Hardcoded string literals
it('formats annotation', () => {
	const input = '@invocablemethod(label="Test")';
	const expected = '@InvocableMethod(label = "Test")';
	expect(format(input)).toBe(expected);
});

// ✅ Use fixtures from __fixtures__ directories
import { readFileSync } from 'fs';
import { join } from 'path';

it('formats annotation', () => {
	const input = readFileSync(
		join(__dirname, '__fixtures__', 'annotation-single-param', 'input.cls'),
		'utf-8',
	);
	const expected = readFileSync(
		join(
			__dirname,
			'__fixtures__',
			'annotation-single-param',
			'output.cls',
		),
		'utf-8',
	);
	expect(format(input)).toBe(expected);
});
```

**Benefits of using fixtures:**

- Easier to maintain and update test cases
- Better readability for complex inputs/outputs
- Can be shared across multiple tests
- Follows the project's existing pattern

### Avoid Test Interdependencies

```typescript
// ❌ Tests depend on shared mutable state
let counter = 0;
it('increments', () => {
	counter++;
	expect(counter).toBe(1);
});
it('increments again', () => {
	counter++;
	expect(counter).toBe(2);
});

// ✅ Each test is isolated
it('increments from zero', () => {
	const counter = createCounter();
	counter.increment();
	expect(counter.value).toBe(1);
});
```

### Use `vi.fn()` and `vi.spyOn()` Effectively

```typescript
// ✅ Mock with type safety
const mockFormat = vi.fn<[string], string>().mockReturnValue('formatted');

// ✅ Spy on methods
const spy = vi.spyOn(printer, 'print');
format(input);
expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'class' }));

// ✅ Clear mocks in beforeEach
beforeEach(() => {
	vi.clearAllMocks();
});
```

### Use `vi.mocked()` for Type-Safe Mocks

```typescript
import { myFunction } from './module';
vi.mock('./module');

// ✅ Get typed mock with vi.mocked()
const mockedFn = vi.mocked(myFunction);
mockedFn.mockReturnValue('test');

// ✅ Deep mocking for objects
const mockedModule = vi.mocked(myModule, { deep: true });
```

### Use `vi.hoisted()` for Mock Setup

```typescript
// ✅ Hoist variables needed in vi.mock factory
const mockImpl = vi.hoisted(() => vi.fn(() => 'mocked'));

vi.mock('./module', () => ({
	myFunction: mockImpl,
}));

// mockImpl is available and hoisted above the vi.mock call
```

### Module Mocking with Better Types

```typescript
// ✅ Use import() syntax for better IDE support and types
vi.mock(import('./module'), () => ({
	myFunction: vi.fn(),
}));

// ✅ Partial mock - keep original implementations
vi.mock('./module', async (importOriginal) => ({
	...(await importOriginal()),
	onlyThisFunction: vi.fn(),
}));

// ✅ Automock with spies
vi.mock('./module', { spy: true });
```

### Test Code Quality Checklist

- [ ] Test descriptions clearly state what is being tested
- [ ] Related tests are grouped in `describe` blocks
- [ ] Duplicate tests are consolidated with `it.each` or `it.for`
- [ ] Setup/teardown is properly scoped (beforeEach vs beforeAll)
- [ ] No test interdependencies
- [ ] Appropriate matchers are used
- [ ] Type safety is maintained in test utilities
- [ ] No commented-out tests (remove or fix)
- [ ] Concurrent tests use `expect` from test context
- [ ] Appropriate use of `.concurrent` - independent tests use `.concurrent`,
      tests with shared state or dependencies do not
- [ ] Fixtures used for complex, reusable setup

### Coverage Ignore Comments

Use V8 coverage ignore comments sparingly for intentionally uncovered code:

```typescript
// ✅ Ignore a single line
/* v8 ignore next */
if (process.env.DEBUG) console.log(data);

// ✅ Ignore multiple lines
/* v8 ignore next 3 */
if (process.env.DEBUG) {
	console.log('debugging...');
}

// ✅ Ignore a block
/* v8 ignore start */
function debugOnly() {
	// This function is only for debugging
}
/* v8 ignore stop */

// ✅ For esbuild (which strips comments), add @preserve
/* v8 ignore next -- @preserve */
```

### Recommended Vitest Configuration

Consider these configuration options in `vitest.config.ts`:

```typescript
export default defineConfig({
	test: {
		// ✅ Automatically clear mocks between tests
		clearMocks: true,

		// ✅ Reset mock implementations between tests
		mockReset: true,

		// ✅ Restore original implementations after tests (for vi.spyOn)
		restoreMocks: true,

		// ✅ Stop after first failure for faster feedback during development
		// bail: 1,

		// ✅ Highlight tests slower than threshold (ms)
		slowTestThreshold: 300,

		// ✅ Shuffle test order to catch interdependencies
		sequence: {
			shuffle: true,
			seed: Date.now(), // or fixed seed for reproducibility
		},

		// ✅ Fail if .only is committed (CI protection)
		allowOnly: !process.env.CI,

		// ✅ Coverage thresholds
		coverage: {
			enabled: true,
			provider: 'v8',
			thresholds: {
				statements: 80,
				branches: 80,
				functions: 80,
				lines: 80,
			},
		},
	},
});
```

### Performance Configuration

Optimise test execution speed:

```typescript
export default defineConfig({
	test: {
		// ✅ Use threads pool for faster execution (if compatible)
		pool: 'threads',

		// ✅ Disable isolation if tests have no side effects (faster)
		// isolate: false,

		// ✅ Limit file search scope
		dir: 'test',

		// ✅ Enable experimental filesystem cache for faster reruns
		// experimental: {
		//   fsModuleCache: true,
		// },
	},
});
```

CLI performance options:

```bash
# Faster pool (if compatible with your tests)
vitest --pool=threads

# Disable isolation for stateless tests
vitest --no-isolate

# Disable file parallelism (reduces startup overhead for few tests)
vitest --no-file-parallelism
```

## Per-File Optimization Process

For each file being optimized:

1. **Analyze** the file for optimization opportunities (use Pre-Optimization
   Analysis checklist)
2. **For test files (`tests/*.test.ts`):** Read `docs/VITEST.md` before
   optimizing to understand Vitest best practices and project-specific guidance
3. **Verify code organization** (for `src/*.ts` files only, excluding
   `src/refs/*.ts`) - ensure all code in the file belongs there based on purpose
   and logical grouping. Move code to the appropriate file if it's misplaced.
4. **Verify test organization** (for `tests/*.test.ts` files) - ensure tests are
   in the correct test file based on what they're testing. Move tests to the
   appropriate test file if they're misplaced.
5. **Check for hardcoded test fixtures** (for `tests/*.test.ts` files) - replace
   hardcoded string literals for input/output expectations with fixtures from
   `__fixtures__` directories
6. **Consider concurrent test optimization** (for `tests/*.test.ts` files) -
   identify independent tests that could use `.concurrent` to improve execution
   speed, or remove `.concurrent` from tests that share state or have
   dependencies
7. **Check for unused exports** - verify all exports are actually imported and
   used elsewhere in the codebase (including tests)
8. **Review comments** - update or remove outdated comments that no longer
   accurately describe the code
9. **Apply optimizations** systematically (one logical change at a time)
10. **Check linting** after each significant change (not just at the end)
11. **Fix linting issues immediately** - this may require multiple iterations:
    - Fix the linting error
    - Re-run linting to check for new issues
    - Repeat until clean
12. **Verify** the file still works (run tests if possible)
13. **Re-check linting** one final time for that specific file
14. **Document** what was changed and why

**CRITICAL:** Do not move to the next file until the current file passes
linting. This prevents accumulating issues across multiple files and ensures
each optimization is complete before proceeding.

**Linting Fix Cycle:** The cycle may be:

- Optimize → Lint → Fix → Lint → Fix → Lint (until clean) → Test → Lint (final
  check)

**Testing Strategy:**

- **Linting:** Must be fixed per-file, immediately after changes
- **Testing:** Can be done per-file OR after all files are optimized (with
  linting fixed)

If optimizing multiple files:

1. Optimize all files (fixing linting per-file)
2. Run full test suite once at the end
3. Fix any test failures
4. Re-check linting after test fixes

This balances early issue detection with workflow efficiency. However, if you're
unsure about an optimization's impact, test immediately after that specific
change.

## Final Verification Steps

**IMPORTANT: pnpm Command Permissions**

All pnpm commands (`pnpm format`, `pnpm lint`, `pnpm test`, etc.) **require full
permissions** and will **fail in sandbox mode**. When running these commands in
Cursor, ensure you request the necessary permissions (typically `all` or
`git_write` and `network`) if the commands fail with permission errors.

After each optimization pass, **always** complete the following verification
cycle:

**Recommended order:**

### Step 1: Format Code First

```bash
pnpm format
```

**Note:** This command requires full permissions and will fail in sandbox mode.
Ensure appropriate permissions are granted when running in Cursor.

This ensures a consistent baseline before checking for issues.

### Step 2: Check and Fix Linting Issues

```bash
pnpm lint
```

**Note:** This command requires full permissions and will fail in sandbox mode.
Ensure appropriate permissions are granted when running in Cursor.

**CRITICAL:** Linting must pass before optimization is considered complete. All
linting errors must be fixed, not ignored.

**Important:** Sometimes fixing linting issues creates new linting issues, so
linting should be checked **again after making changes**.

If linting errors are found:

1. **Fix the linting errors immediately** - do not proceed with more
   optimizations until linting passes
2. **Re-run linting** to ensure no new issues were introduced
3. If new issues appear, fix them and repeat until clean
4. **Never leave linting errors for later** - they compound and become harder to
   fix

#### Common Linting Issues and How to Fix Them

**Resolving ESLint Rule Conflicts:**

Sometimes ESLint rules conflict (e.g., `prefer-optional-chain` vs
`strict-boolean-expressions`). When this occurs:

- **Use nullish coalescing with explicit boolean conversion:**

    ```typescript
    // ✅ Resolves both rules
    return nodeClass?.includes('Identifier') ?? false;
    ```

- **Prefer explicit checks when optional chaining creates ambiguity:**

    ```typescript
    // ✅ When strict-boolean-expressions requires explicit checks
    if (value !== undefined && value.includes('pattern')) { ... }
    ```

- **Document the conflict** if a disable comment is necessary, explaining why
  both rules can't be satisfied simultaneously.

**Magic Numbers:**

- Extract as named constants when they represent business logic or configuration
  values
- For array indices (0, 1, 2, etc.) and string positions, consider:
    - Extracting as constants if used multiple times:
      `const ARRAY_START_INDEX = 0`
    - Using ESLint disable comments with justification for legitimate uses:
      `// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- array index`
- Prefer extracting constants over disabling rules when possible
- **CRITICAL ANTI-PATTERN:** Do NOT remove existing constants if doing so would
  require adding multiple ESLint disable comments. If a constant like
  `ARRAY_START_INDEX = 0` or `ZERO_LENGTH = 0` is used in multiple places,
  removing it and replacing with the literal value would require multiple
  disable comments, which is worse than keeping the constant. The constant
  provides semantic meaning and avoids code duplication of disable comments.
  Only remove constants if they are truly unused or if removing them doesn't
  require adding disable comments.

**Type Safety Issues:**

- Replace nullable conditionals with explicit null checks:

    ```typescript
    // ❌ Bad
    if (value) { ... }

    // ✅ Good
    if (value !== null && value !== undefined) { ... }
    // Or use nullish coalescing where appropriate
    ```

- Replace unsafe type assertions with type guards or proper type narrowing
- Use `Readonly<T>` for parameters that shouldn't be mutated
- Fix unsafe assignments by adding proper type guards

**Index Signature Property Access:**

When working with objects that have index signatures (e.g.,
`[key: string]: unknown`), property access requires special handling:

```typescript
// ❌ ESLint error: Prefers dot notation
const value = node['value'];

// ✅ Type-narrow first, then use dot notation on typed assertion
const value =
	'value' in node && typeof (node as { value?: unknown }).value === 'string'
		? (node as { value: string }).value
		: undefined;

// ✅ For write operations on assertions, use dot notation (not bracket)
(node as { value: string }).value = newValue; // ✅
(node as { value: string })['value'] = newValue; // ❌ ESLint prefers dot notation
```

The key pattern: Use bracket notation for type narrowing checks
(`node['value']`), but once you've narrowed the type with an assertion, use dot
notation for actual property access.

**Unnecessary Conditionals:**

- Remove conditionals that TypeScript knows are always true/false
- Use type narrowing instead of runtime checks when types guarantee structure

**Unused ESLint Disable Directives:**

- Remove any `eslint-disable` comments that are no longer needed
- Run `pnpm lint --fix` to auto-fix some issues

**Readonly Parameter Types:**

- Add `Readonly<T>` to function parameters in tests and source code
- Use `Readonly<{ ... }>` for object parameters

#### Linting Fix Strategy

When fixing linting issues during optimization:

1. **Read the full error message** - understand what the rule is checking
2. **Check for related rules** - fixing one may trigger another
3. **Use the most appropriate fix** - not just the quickest:
    - Prefer code changes over disable comments
    - Use nullish coalescing (`??`) for optional chaining conflicts
    - Use explicit checks when strict-boolean-expressions requires it
4. **Re-run linting immediately** after each fix
5. **Document non-obvious fixes** with inline comments explaining why

**Common Fix Patterns:**

- `prefer-optional-chain` + `strict-boolean-expressions`: Use
  `(value?.method() ?? false)`
- `no-magic-numbers`: Extract constant or disable with justification
- `prefer-readonly-parameter-types`: Add `Readonly<T>` wrapper
- `no-unsafe-type-assertion`: Replace with type guard or proper narrowing
- `@typescript-eslint/dot-notation`: Use dot notation on type assertions:
  `(obj as Type).prop` not `(obj as Type)['prop']`

### Quick Reference: Common ESLint Fixes During Optimization

| ESLint Rule                                            | Issue                         | Solution                                                           |
| ------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------ |
| `@typescript-eslint/dot-notation`                      | Bracket notation on assertion | Use dot notation: `(obj as Type).prop` not `(obj as Type)['prop']` |
| `@typescript-eslint/prefer-readonly-parameter-types`   | Mutable parameter             | Add `Readonly<T>` wrapper                                          |
| `@typescript-eslint/no-unsafe-type-assertion`          | Unsafe assertion              | Use type guards: `'prop' in obj && typeof obj.prop === 'type'`     |
| `@typescript-eslint/no-unsafe-assignment`              | Unsafe assignment             | Type-narrow before assignment                                      |
| `prefer-optional-chain` + `strict-boolean-expressions` | Conflict                      | Use nullish coalescing: `value?.method() ?? false`                 |

### Step 3: Run Unit Tests

```bash
pnpm test
```

**Note:** This command requires full permissions and will fail in sandbox mode.
Ensure appropriate permissions are granted when running in Cursor.

**Expected Result:** All tests must pass (typically 111 tests across 5 test
files).

**Note:** Fixing unit tests can introduce linting issues, so re-check linting
after test fixes.

### Step 4: Re-check Linting (if test fixes were made)

If test fixes were applied, re-run linting to ensure no new issues:

```bash
pnpm lint
```

### Step 5: Final Test Run

Re-run tests one final time to ensure everything passes:

```bash
pnpm test
```

## Verification Cycle Summary

The complete verification cycle should be:

1. ✅ Format code (`pnpm format`) - ensures consistent baseline
2. ✅ Check linting (`pnpm lint`) - catch issues early
3. ✅ Fix linting issues if found
4. ✅ **Re-check linting** (CRITICAL: fixing linting can create new issues)
5. ✅ **Repeat steps 3-4** until linting is completely clean (may take 2-3
   iterations)
6. ✅ Run tests (`pnpm test`) - verify functionality
7. ✅ Fix any test failures
8. ✅ Re-check linting after test fixes (test fixes can introduce linting
   issues)
9. ✅ Re-run tests for final verification

**Note:** Steps 3-4 may need to be repeated multiple times. Don't proceed to
testing until linting is completely clean.

## When to Stop Optimizing

Stop when:

- **All tests pass** ✅
- **No linting errors or warnings** ✅ (CRITICAL - optimization is incomplete if
  linting fails)
- **Code is properly formatted** ✅
- **No new optimization opportunities are identified** after thorough analysis
- **Further changes would harm readability** without significant benefit
- **All identified patterns have been addressed** (magic numbers, duplicates,
  etc.)

**IMPORTANT:** Optimization is **NOT complete** if there are linting errors.
Linting errors indicate code quality issues that must be resolved before
considering the optimization finished.

- **Code complexity is reduced** and maintainability is improved

## Success Criteria

The optimization is complete when:

- ✅ **All unit tests pass** (typically 106+ tests)
- ✅ **Zero linting errors or warnings** (CRITICAL - this is a hard requirement)
- ✅ **Code is properly formatted** (Prettier has been run)
- ✅ **No further optimizations can be performed** without compromising
  functionality
- ✅ **Code complexity has been reduced** (removed redundant logic, simplified
  algorithms, eliminated unnecessary code)
- ✅ **Functionality is preserved** (all tests pass)
- ✅ **Code is more maintainable and easier to understand**
- ✅ **Modern TypeScript patterns are utilised** where appropriate
- ✅ **Test descriptions are accurate and informative**
- ✅ **Tests pass with `sequence.shuffle` enabled** (no interdependencies)
- ✅ **Coverage thresholds are maintained**

**CRITICAL:** If any linting errors remain, the optimization is **NOT
complete**. All linting issues must be resolved before the optimization can be
considered finished.

**Note:** Line count reduction may occur as a side effect of real optimizations,
but it is not the primary goal. Prettier will reformat code according to its
rules, so focusing on formatting changes is counterproductive.

## Iteration Tracking

After each optimization pass, document:

- **Optimizations applied:** List specific improvements made
- **Issues encountered:** Note any problems or blockers
- **Remaining opportunities:** Identify areas still needing work
- **Metrics (optional):** Note complexity improvements (cyclomatic complexity,
  function length, etc.)

## Final Summary Format

After completing the optimization, provide a summary that includes:

- **Test Results:** Number of tests passed (must be 100%)
- **Lint Results:** Status of linting checks (must be zero errors and warnings)
- **Code Complexity Reduction:** Improvements in logic, structure, and
  maintainability (not just line count)
- **Functionality:** Confirmation that all features work correctly
- **Code Quality:** Notes on improvements made
- **Linting Status:** Explicit confirmation that all linting errors are resolved

**CRITICAL:** The summary must explicitly state that linting passes with zero
errors. If linting errors remain, the optimization is incomplete.

Example summary:

```
## Summary
- All 106 unit tests passing ✅
- Zero linting errors or warnings ✅ (CRITICAL - all issues resolved)
- Code complexity reduced (removed redundant logic, simplified algorithms)
- Functionality preserved
- Consistent functional style throughout
- Modern TypeScript patterns applied
- Test descriptions improved for clarity
- More maintainable and easier to understand
- All type safety issues fixed
- All magic numbers extracted or justified
- All type safety issues fixed
- All magic numbers extracted or justified
```

## Documentation Requirements

When making optimization decisions:

- **Document why regex is used** instead of AST manipulation (if applicable)
- **Document why certain optimizations weren't made** (e.g., would harm
  readability)
- **Add comments for complex optimizations** explaining the reasoning
- **Update function documentation** if behavior changes significantly

## Lessons Learned from Optimization Passes

### Linting Issues

- Linting fixes often create new linting issues - always re-check
- Rule conflicts (e.g., optional chaining vs strict booleans) require creative
  solutions
- Some optimizations that reduce code size may trigger new linting rules
- The iterative lint-fix cycle is essential - don't skip re-checking

### Optimization Balance

- Not all "optimizations" are worth it if they harm readability
- Caching repeated property access is almost always worth it
- Consolidating error messages improves maintainability significantly
- Extracting repeated calculations improves both performance and readability

### Type Safety

- Type guards are preferable to type assertions, but may require more code
- Sometimes explicit checks are clearer than clever type narrowing
- Readonly parameters help catch bugs but may require more type annotations
- Nullish coalescing (`??`) is often the solution for optional chaining
  conflicts

### Index Signature Access Patterns

- TypeScript requires bracket notation for property access on index signatures
- ESLint prefers dot notation, but only after type narrowing
- Solution: Use type assertions with dot notation after narrowing checks
- Pattern:
  `'key' in obj && typeof (obj as { key?: T }).key === 'type' ? (obj as { key: T }).key : ...`

### Boolean Expression Simplification

- Complex boolean expressions with multiple semantic conditions benefit from
  early returns
- Logical OR operators are cleaner than multiple early returns when all branches
  return the same type
- Consider readability: sometimes slightly more lines are clearer than fewer
  lines

### Process

- Fix linting issues immediately after each change, not at the end
- Re-check linting after every fix - it's not redundant, it's necessary
- Format code first to establish a consistent baseline
- Test after each file to catch issues early

## Common Pitfalls to Avoid

- **Don't optimize prematurely** - ensure tests pass first
- **Don't break functionality for optimization** - maintain all existing
  behavior
- **Don't create overly clever code** - prioritize readability
- **Don't remove necessary checks** - only remove truly redundant ones
- **Don't optimize formatting** - Prettier handles that
- **Don't ignore ESLint warnings or errors** - fix the underlying issue when
  possible
- **Don't leave linting errors for later** - fix them immediately after each
  change
- **Don't create micro-optimizations** that harm readability
- **Don't remove tests** - only optimize their structure
- **Don't change test fixtures** - only improve test code quality
- **Don't use magic numbers** - extract as constants or disable with
  justification. **Don't remove existing constants** if doing so would require
  adding multiple ESLint disable comments - this is an anti-pattern
- **Don't skip type safety** - fix nullable conditionals, unsafe assignments,
  and type assertions
- **Don't accumulate linting issues** - fix them per-file, not at the end
- **Don't leave unused exports** - remove exports that aren't imported anywhere
- **Don't leave outdated comments** - update or remove comments that no longer
  accurately describe the code
- **Don't misplace code** - ensure code in `src/*.ts` files (excluding
  `src/refs/*.ts`) is in the correct file based on its purpose and logical
  grouping
- **Don't misplace tests** - ensure tests in `tests/*.test.ts` files are in the
  correct test file based on what they're testing
- **Don't hardcode test fixtures** - use `__fixtures__` directories for test
  input/output expectations instead of hardcoding string literals
- **Don't hardcode values that Prettier/prettier-plugin-apex already provide** -
  prefer using existing constants, utilities, and functions from these libraries
  over hardcoded values

## Notes

- **pnpm Command Permissions:** All pnpm commands (`pnpm format`, `pnpm lint`,
  `pnpm test`, etc.) require full permissions and will fail in sandbox mode.
  When running these commands in Cursor, ensure you request the necessary
  permissions if the commands fail with permission errors.
- **Iterative Approach:** This is not a one-time task. Continue optimizing until
  no further improvements are possible.
- **Test-Driven:** Never compromise test coverage or functionality for code
  size.
- **Linting is Mandatory:** Linting errors must be fixed immediately after each
  optimization change. Do not proceed to the next file or optimization until
  linting passes. Optimization is incomplete if linting fails.
- **Linting Awareness:** Always re-check linting after making changes, as fixes
  can introduce new issues. Run `pnpm lint` after every significant change.
- **Format First:** Run the format command early to ensure consistent baseline
  before checking for issues.
- **AST First:** Always prefer AST manipulation over regex. The AST provides a
  structured, reliable way to work with code. Regex should only be used when AST
  manipulation is not feasible (e.g., preprocessing text before parsing).
- **ESLint Disable Comments:** Minimize use of ESLint disable comments. When
  necessary, use the smallest scope possible and always include a justification.
  If the same rule needs multiple disables in a function, scope it at the
  function level. If multiple in a file, scope it at the file level. Remove
  unused disable directives.
- **Optimize Logic, Not Formatting:** Focus on removing redundant code,
  simplifying algorithms, and improving structure. Do not condense code just to
  reduce line counts - Prettier will reformat it anyway. Real optimizations
  improve maintainability and performance, not just appearance.
- **Modern TypeScript:** Leverage the latest TypeScript features (`satisfies`,
  `using`, `const` type parameters, `NoInfer<T>`) where they improve type safety
  or code clarity.
- **Type Safety:** Always fix type safety issues (nullable conditionals, unsafe
  assignments, unnecessary type assertions) as part of optimization. Do not
  leave them for later.
- **Magic Numbers:** Extract magic numbers as constants when they represent
  business logic. For array indices and string positions, either extract as
  constants or disable with justification. Prefer extraction over disabling.
  **However, prefer Prettier and prettier-plugin-apex constants/functions over
  hardcoded values** - check if these libraries already provide the needed
  constant or utility before creating a new one. **CRITICAL:** Do NOT remove
  existing constants if doing so would require adding multiple ESLint disable
  comments - this is an anti-pattern. Keeping a constant that's used multiple
  times is better than replacing it with literals and adding multiple disable
  comments.
- **Code Organization:** Verify that code in `src/*.ts` files (excluding
  `src/refs/*.ts`) is in the correct file based on purpose and logical grouping.
  Move misplaced code to the appropriate file (e.g., annotation-related code
  should be in `annotations.ts`, collection-related code in `collections.ts`).
- **Unused Exports:** Check all exports against actual imports across the entire
  codebase (including tests). Remove any exports that aren't used anywhere.
- **Comment Accuracy:** Review all comments for accuracy. Update comments that
  describe outdated behavior or remove comments that are no longer relevant.
- **Test Optimization Reference:** **Always consult `docs/VITEST.md`** when
  optimizing test files. This document contains comprehensive Vitest reference
  information, best practices, and project-specific guidance that must be
  followed.
- **Test Organization:** Ensure tests in `tests/*.test.ts` files are in the
  correct test file based on what they're testing (e.g., tests for
  `annotations.ts` should be in `tests/annotations.test.ts` or similar).
- **Test Fixtures:** Use `__fixtures__` directories for test fixtures instead of
  hardcoding string literals for input/output expectations. This improves
  maintainability and follows the project's existing pattern.
- **Vitest Features:** Use Vitest's full feature set (`it.each`, `it.for`,
  inline snapshots, concurrent tests, typed mocks, fixtures, soft assertions) to
  improve test maintainability.
- **Test Isolation:** Use `sequence.shuffle` in CI to catch test
  interdependencies early.
- **Mock Cleanup:** Prefer config-level `clearMocks`/`mockReset`/`restoreMocks`
  over manual cleanup in `beforeEach`.
- **Concurrent Tests:** Consider appropriate use of `.concurrent` when
  optimizing tests. Use `.concurrent` for independent tests that can run in
  parallel to improve execution speed. Do NOT use `.concurrent` for tests that
  share state, have dependencies, or modify global state. When using concurrent
  tests, always use `expect` from the test context, not the global import.

## Plan Improvement and Iteration

After each optimization pass, the AI agent should:

1. **Review the optimization experience** and identify areas where the plan
   could be improved
2. **Suggest specific improvements** to the plan based on what was encountered
   during optimization
3. **Document improvements** in the relevant sections of this plan

When suggesting improvements, consider:

- **New patterns discovered** during optimization
- **Common pitfalls** that weren't documented
- **Workflow improvements** that could streamline the process
- **Clarifications** needed for ambiguous guidance
- **Missing examples** that would have helped
- **Tool-specific issues** encountered (ESLint, TypeScript, etc.)

Document improvements in the relevant sections (Common Optimization Patterns,
Lessons Learned, Common Linting Issues, etc.) to help future optimization passes
be more efficient and effective.
