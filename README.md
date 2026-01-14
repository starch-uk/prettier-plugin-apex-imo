# prettier-plugin-apex-imo

[![npm version](https://img.shields.io/npm/v/prettier-plugin-apex-imo.svg)](https://www.npmjs.com/package/prettier-plugin-apex-imo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/starch-uk/prettier-plugin-apex-imo/actions/workflows/ci.yml/badge.svg)](https://github.com/starch-uk/prettier-plugin-apex-imo/actions/workflows/ci.yml)

> **IMO** = In My Opinion. Because Prettier is opinionated, and so am I.

An opinionated enhancement for
[prettier-plugin-apex](https://github.com/dangmai/prettier-plugin-apex) that
enforces multiline formatting for Apex Lists, Sets, and Maps with multiple
entries, and formats code inside ApexDoc `{@code}` blocks.

## The Problem

When using `prettier-plugin-apex`, code like this:

```apex
final String expectedJson = String.join(new List<String>{
  '{',
  '  "tags" : [ "reading", "gaming", "coding" ]',
  '}'
}, '\n');
```

Gets reformatted to a single line, defeating the purpose of readable formatting:

```apex
final String expectedJson = String.join(new List<String>{ '{', '  \"tags\" : [ \"reading\", \"gaming\", \"coding\" ]', '}' }, '\n');
```

## The Solution

This plugin wraps `prettier-plugin-apex` and modifies the printing behaviour:

- **List literals** with 2+ entries → Always multiline
- **Map literals** with 2+ entries → Always multiline
- **Set literals** with 2+ entries → Always multiline
- **ApexDoc `{@code}` blocks** → Code inside is formatted using Prettier
- **Enhanced comment handling** → Better comment placement and attachment using
  Prettier's comment system

This is **non-configurable** behaviour. Once installed, it just works.

## Architecture

This plugin has been architected with **AST-based processing** as the primary
approach, minimizing regex usage and maximizing leverage of Prettier's
infrastructure:

- **AST-First Processing**: Works with comment AST nodes and token structures
  rather than raw text parsing
- **Prettier Integration**: Uses Prettier's doc builders (`fill`, `join`) for
  text formatting instead of regex-based word splitting
- **Minimal Regex**: Only uses regex where absolutely necessary (complex
  annotation parsing, preprocessing)
- **Character-Based Fallbacks**: Uses simple character scanning only for text
  content within AST nodes (like code blocks in comments)

### Benefits

- **Better Performance**: Reduced regex compilation overhead
- **Improved Reliability**: AST operations are more predictable than complex
  regex patterns
- **Enhanced Maintainability**: Structured processing is easier to understand
  and modify
- **Future Compatibility**: Leverages Prettier's AST infrastructure for better
  long-term compatibility

## Comment Handling Improvements

This plugin includes enhanced comment handling that leverages Prettier's
built-in comment attachment system:

- **Smart comment placement** for Apex-specific constructs (classes, interfaces,
  block statements)
- **Dangling comment support** for empty code blocks
- **Binary expression comments** properly attached to right operands
- **Block statement leading comments** moved into block bodies for better
  formatting

These improvements ensure comments are placed more intelligently and
consistently with Prettier's standards.

## Installation

```bash
pnpm add -D prettier prettier-plugin-apex prettier-plugin-apex-imo
```

Or with npm:

```bash
npm install --save-dev prettier prettier-plugin-apex prettier-plugin-apex-imo
```

## Usage in Salesforce Projects

If you're working with a Salesforce project (created with `sf project generate`
or Salesforce DX), follow these steps:

1. **Install the plugin:**

    ```bash
    npm install --save-dev prettier-plugin-apex-imo
    ```

    Standard Salesforce projects already include `prettier` and
    `prettier-plugin-apex` in their `package.json`, so you only need to install
    `prettier-plugin-apex-imo`.

2. **Update your `.prettierrc` file:**

    Replace `prettier-plugin-apex` with `prettier-plugin-apex-imo` in the
    plugins array:

    ```json
    {
    	"trailingComma": "none",
    	"plugins": ["prettier-plugin-apex-imo", "@prettier/plugin-xml"]
    }
    ```

    The `prettier-plugin-apex-imo` plugin wraps `prettier-plugin-apex`, so you
    only need to specify `prettier-plugin-apex-imo` in your config. However,
    **both plugins must be installed** since `prettier-plugin-apex` is a peer
    dependency.

3. **Verify the configuration:**

    ```bash
    npm run prettier:verify
    ```

    Or format your files:

    ```bash
    npm run prettier
    ```

    Standard Salesforce projects typically include a `prettier` script in
    `package.json` that formats all relevant files including Apex classes
    (`.cls`) and triggers (`.trigger`).

## Examples

### Before (prettier-plugin-apex)

```apex
List<String> items = new List<String>{ 'one', 'two', 'three' };
Set<String> tags = new Set<String>{ 'reading', 'gaming', 'coding' };
Map<String, Integer> counts = new Map<String, Integer>{ 'a' => 1, 'b' => 2 };
```

### After (prettier-plugin-apex-imo)

```apex
List<String> items = new List<String>{
  'one',
  'two',
  'three'
};
Set<String> tags = new Set<String>{
  'reading',
  'gaming',
  'coding'
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
Set<String> singleSet = new Set<String>{ 'only' };
Map<String, Integer> singleMap = new Map<String, Integer>{ 'key' => 1 };
```

### ApexDoc {@code} Block Formatting

Code inside ApexDoc `{@code}` blocks is automatically formatted using Prettier:

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

The formatting:

- Aligns with the opening bracket of `{@code`
- Maintains the `*` vertical alignment of the comment block
- Handles nested braces correctly
- Preserves invalid blocks (unmatched brackets or invalid code) unchanged

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

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md)
file for details.

## Acknowledgements

- [prettier-plugin-apex](https://github.com/dangmai/prettier-plugin-apex) by
  Dang Mai
- [Prettier](https://prettier.io/) for the amazing formatting engine
