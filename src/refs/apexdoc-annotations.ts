/**
 * @file Complete list of ApexDoc annotation tags. This file contains all standard ApexDoc tags that must be normalized to lowercase.
 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_doc_format.htm}
 */

const APEXDOC_ANNOTATIONS: readonly string[] = [
	'param',
	'return',
	'throws',
	'see',
	'since',
	'author',
	'version',
	'deprecated',
	'group',
	'example',
] as const;

/**
 * Mapping of lowercase group names to their proper case.
 * Used for normalizing \@group annotation values.
 */
const APEXDOC_GROUP_NAMES: Readonly<Record<string, string>> = {
	class: 'Class',
	enum: 'Enum',
	interface: 'Interface',
	method: 'Method',
	property: 'Property',
	variable: 'Variable',
} as const;

export { APEXDOC_ANNOTATIONS, APEXDOC_GROUP_NAMES };
