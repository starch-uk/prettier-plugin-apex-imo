/**
 * @file Complete list of Apex escape sequences. Reference: https://help.salesforce.com/s/articleView?language=en_US&id=analytics.bi_security_datasets_predicate_escapesequences.htm&type=5. Apex uses Java-like escape sequences for string literals. This file contains all escape sequences that can appear in Apex string literals.
 */

// Constants for regex match indices and sequence lengths
const regexMatchIndex = 0;
const standardSequenceLength = 2;
const unicodeSequenceLength = 6;

/**
 * Mapping of escape sequence patterns to their descriptions
 * These are the escape sequences that can appear in Apex string literals
 * All escape sequences start with a backslash (\) followed by specific characters.
 */
const escapeSequenceEntries: [string, string][] = [
	// Standard escape sequences
	['\\n', 'Newline'],
	['\\t', 'Horizontal tab'],
	['\\r', 'Carriage return'],
	['\\b', 'Backspace'],
	['\\f', 'Form feed'],
	['\\\\', 'Backslash'],
	["\\'", 'Single quote'],
	['\\"', 'Double quote'],
	// Unicode escape sequences (4 hex digits)
	// Pattern: \uXXXX where XXXX is a hexadecimal number
];
const ESCAPE_SEQUENCES: Record<string, string> = Object.fromEntries(
	escapeSequenceEntries,
) as Record<string, string>;

/**
 * Array of escape sequence patterns (without descriptions)
 * Used for pattern matching and validation.
 */
const ESCAPE_SEQUENCE_PATTERNS: readonly string[] = Object.keys(
	ESCAPE_SEQUENCES,
) as readonly string[];

/**
 * Regular expression pattern to match standard escape sequences
 * Matches: \n, \t, \r, \b, \f, \\, \', \".
 */
const STANDARD_ESCAPE_SEQUENCE_REGEX = /\\([ntrbf\\'"])/g;

/**
 * Regular expression pattern to match Unicode escape sequences
 * Matches: \uXXXX where XXXX is exactly 4 hexadecimal digits.
 */
const UNICODE_ESCAPE_SEQUENCE_REGEX = /\\u([0-9a-fA-F]{4})/g;

/**
 * Regular expression pattern to match all escape sequences (standard + Unicode)
 * This is a combined pattern that matches both types.
 */
const ALL_ESCAPE_SEQUENCE_REGEX = /\\([ntrbf\\'"]|u[0-9a-fA-F]{4})/g;

/**
 * Check if a string contains a valid escape sequence.
 * @param text - The text to check.
 * @returns True if the text contains a valid escape sequence, false otherwise.
 * @example
 * ```typescript
 * containsEscapeSequence('Hello\\nWorld'); // Returns true
 * containsEscapeSequence('Hello World'); // Returns false
 * ```
 */
function containsEscapeSequence(text: string): boolean {
	return ALL_ESCAPE_SEQUENCE_REGEX.test(text);
}

/**
 * Get all escape sequences found in a string.
 * @param text - The text to search.
 * @returns Array of matched escape sequences.
 * @example
 * ```typescript
 * findEscapeSequences('Hello\\nWorld\\t'); // Returns ['\\n', '\\t']
 * ```
 */
function findEscapeSequences(text: string): string[] {
	const matches: string[] = [];
	let match: RegExpExecArray | null = null;

	// Reset regex lastIndex to ensure we start from the beginning
	ALL_ESCAPE_SEQUENCE_REGEX.lastIndex = regexMatchIndex;

	while ((match = ALL_ESCAPE_SEQUENCE_REGEX.exec(text)) !== null) {
		matches.push(match[regexMatchIndex]);
	}

	return matches;
}

/**
 * Validate that all escape sequences in a string are valid.
 * @param text - The text to validate.
 * @returns True if all escape sequences are valid, false otherwise.
 * @example
 * ```typescript
 * isValidEscapeSequences('Hello\\nWorld'); // Returns true
 * isValidEscapeSequences('Hello\\xWorld'); // Returns false
 * ```
 */
function isValidEscapeSequences(text: string): boolean {
	// Find all backslash sequences
	const backslashPattern = /\\./g;
	const allSequences: string[] = [];
	let match: RegExpExecArray | null = null;

	backslashPattern.lastIndex = regexMatchIndex;
	while ((match = backslashPattern.exec(text)) !== null) {
		allSequences.push(match[regexMatchIndex]);
	}

	// Check if all sequences are valid
	return allSequences.every((seq) => {
		// Check if it's a standard escape sequence (single char after backslash)
		if (
			seq.length === standardSequenceLength &&
			/^\\[ntrbf\\'"]$/.test(seq)
		) {
			return true;
		}
		// Check if it's a Unicode escape sequence (\u followed by 4 hex digits)
		if (
			seq.length === unicodeSequenceLength &&
			/^\\u[0-9a-fA-F]{4}$/.test(seq)
		) {
			return true;
		}
		// Invalid escape sequence
		return false;
	});
}

/**
 * Regular expression pattern to match special regex metacharacters that need escaping
 * Matches: . * + ? ^ $ { } ( ) | [ ] \
 * These characters have special meaning in regex and must be escaped to be used literally.
 */
const REGEX_METACHARACTERS_PATTERN = /[.*+?^${}()|[\]\\]/g;

/**
 * Escape special regex metacharacters in a string so they can be used literally in a regex pattern
 * This is different from string literal escape sequences - this is for escaping regex metacharacters.
 * @param text - The text containing characters that may need escaping for regex.
 * @returns The text with regex metacharacters escaped.
 * @example
 * escapeRegexMetacharacters('Account.Name') // Returns 'Account\\.Name'
 * escapeRegexMetacharacters('List<String>') // Returns 'List<String>'
 */
function escapeRegexMetacharacters(text: string): string {
	return text.replace(REGEX_METACHARACTERS_PATTERN, '\\$&');
}

export {
	ESCAPE_SEQUENCES,
	ESCAPE_SEQUENCE_PATTERNS,
	STANDARD_ESCAPE_SEQUENCE_REGEX,
	UNICODE_ESCAPE_SEQUENCE_REGEX,
	ALL_ESCAPE_SEQUENCE_REGEX,
	REGEX_METACHARACTERS_PATTERN,
	containsEscapeSequence,
	findEscapeSequences,
	isValidEscapeSequences,
	escapeRegexMetacharacters,
};
