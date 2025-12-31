/**
 * Complete list of ApexDoc annotation tags
 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_doc_format.htm
 * This file contains all standard ApexDoc tags that must be normalized to lowercase
 */

/**
 * Array of ApexDoc tag names that should be normalized to lowercase
 * These tags are case-insensitive in ApexDoc but should be normalized to lowercase
 * for consistency with Salesforce documentation standards
 */
export const APEXDOC_ANNOTATIONS: readonly string[] = [
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
