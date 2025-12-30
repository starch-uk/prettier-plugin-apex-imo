# prettier-plugin-apex-imo

[![npm version](https://img.shields.io/npm/v/prettier-plugin-apex-imo.svg)](https://www.npmjs.com/package/prettier-plugin-apex-imo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/starch-uk/prettier-plugin-apex-imo/actions/workflows/ci.yml/badge.svg)](https://github.com/starch-uk/prettier-plugin-apex-imo/actions/workflows/ci.yml)

> **IMO** = In My Opinion — because Prettier is opinionated, and so am I.

An opinionated enhancement for
[prettier-plugin-apex](https://github.com/dangmai/prettier-plugin-apex) that
enforces multiline formatting for Apex Lists, Sets, and Maps with multiple
entries.

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
