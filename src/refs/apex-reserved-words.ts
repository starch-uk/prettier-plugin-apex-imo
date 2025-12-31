/**
 * Complete list of Apex reserved keywords
 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_reserved_words.htm
 * This file contains all reserved keywords that cannot be used as identifiers in Apex
 * Reserved keywords are case-sensitive and must be used exactly as defined
 */

/**
 * Array of Apex reserved keywords (lowercase)
 * These keywords cannot be used as identifiers for variables, methods, classes, or interfaces
 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_reserved_words.htm
 */
export const APEX_RESERVED_WORDS: readonly string[] = [
	// Access modifiers and scope
	'global',
	'public',
	'private',
	'protected',
	'transient',
	'with',
	'without',
	'inherited',
	'sharing',
	// Class and interface keywords
	'abstract',
	'class',
	'interface',
	'enum',
	'extends',
	'implements',
	'virtual',
	// Method and variable keywords
	'static',
	'final',
	'override',
	// Control flow
	'if',
	'else',
	'switch',
	'case',
	'default',
	'for',
	'while',
	'do',
	'break',
	'continue',
	'return',
	// Exception handling
	'try',
	'catch',
	'finally',
	'throw',
	// Object and type keywords
	'new',
	'this',
	'super',
	'null',
	'instanceof',
	// Package and import
	'package',
	'import',
	// Other keywords
	'void',
	'goto',
	'const',
	// Apex-specific keywords
	'trigger',
	'webservice',
	// Note: 'list', 'set', 'map' are collection types, not reserved keywords
	// but they are type names that should be normalized to PascalCase
] as const;

/**
 * Set of Apex reserved keywords for fast lookup
 * Derived from APEX_RESERVED_WORDS array for O(1) lookup performance
 */
export const APEX_RESERVED_WORDS_SET: ReadonlySet<string> = new Set(
	APEX_RESERVED_WORDS,
);

/**
 * Array of Apex reserved keywords that can appear before type declarations
 * These are access modifiers and modifiers that can precede type names in declarations
 * Examples: "public String name", "static final Integer count", "global webservice Account acc"
 */
export const DECLARATION_MODIFIERS: readonly string[] = [
	'public',
	'private',
	'protected',
	'static',
	'final',
	'transient',
	'global',
	'webservice',
] as const;

/**
 * Array of Apex reserved keywords that are type-related and should be normalized to lowercase
 * These keywords appear in type declarations and should always be lowercase
 * Examples: "enum MyEnum {}", "class MyClass", "interface MyInterface", "void method()"
 */
export const TYPE_RELATED_RESERVED_WORDS: readonly string[] = [
	'enum',
	'class',
	'interface',
	'void',
	'abstract',
	'virtual',
] as const;

/**
 * Check if a word is an Apex reserved keyword
 * @param word - The word to check (case-insensitive)
 * @returns true if the word is a reserved keyword, false otherwise
 */
export function isReservedWord(word: string): boolean {
	return APEX_RESERVED_WORDS_SET.has(word.toLowerCase());
}
