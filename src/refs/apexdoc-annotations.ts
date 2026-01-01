/**
 * @file Complete list of ApexDoc annotation tags. This file contains all standard ApexDoc tags that must be normalized to lowercase.
 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_doc_format.htm}
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
