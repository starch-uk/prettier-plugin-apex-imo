/**
 * Complete list of Salesforce object type suffixes
 * Reference: https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_list.htm
 * This file contains all standard Salesforce object type suffixes
 */

/**
 * Array of Salesforce object type suffixes
 * These suffixes are used to identify different types of Salesforce objects in type declarations
 * Suffixes are case-sensitive and should be matched exactly as defined
 */
export const APEX_OBJECT_SUFFIXES: readonly string[] = [
	// Common object types
	'__c', // Custom object
	'__b', // Big object
	'__ChangeEvent', // Custom Object Change Event
	'__chn', // PlatformEventChannel
	'__cio', // Calculated insight object
	'__dg', // Data graph
	'__DataCategorySelection', // Knowledge__DataCategorySelection
	'__dlm', // Data Model Object (DMOs used for queries have this extension)
	'__dlo', // Data Lake Object
	'__dmo', // Data Model Object
	'__dso', // Data source object
	'__e', // Platform event
	'__Feed', // Knowledge article feed or custom object feed
	'__hd', // Historical data
	'__History', // Field History Tracking for custom objects
	'_hst', // A historical field for a custom report type
	'__ka', // Knowledge article
	'__kav', // Knowledge article version
	'__latitude__s', // Geolocation custom field with latitude coordinates
	'__longitude__s', // Geolocation custom field with longitude coordinates
	'__mdt', // Custom metadata type
	'__pc', // Custom person account field
	'__pr', // Person account relationship field
	'__r', // Custom relationship field as used in a SOQL query to traverse the relationship
	'__Share', // Custom object sharing object
	'__Tag', // Salesforce tags
	'__ViewStat', // KnowledgeArticleViewStat
	'__VoteStat', // KnowledgeArticleVoteStat
	'__x', // External object
	'__xo', // Salesforce-to-Salesforce (S2S) spoke/proxy object
] as const;

/**
 * Set of Salesforce object type suffixes for fast lookup
 * Derived from APEX_OBJECT_SUFFIXES array for O(1) lookup performance
 */
export const APEX_OBJECT_SUFFIXES_SET: ReadonlySet<string> = new Set(
	APEX_OBJECT_SUFFIXES,
);

/**
 * Check if a string ends with a Salesforce object type suffix
 * @param text - The text to check
 * @returns true if the text ends with a known object type suffix, false otherwise
 */
export function hasObjectSuffix(text: string): boolean {
	return APEX_OBJECT_SUFFIXES.some((suffix) => text.endsWith(suffix));
}

/**
 * Get the object type suffix from a string if it exists
 * @param text - The text to check
 * @returns The suffix if found, undefined otherwise
 */
export function getObjectSuffix(text: string): string | undefined {
	// Sort suffixes by length (longest first) to match longer suffixes before shorter ones
	// (e.g., __ChangeEvent should match before __c)
	const sortedSuffixes = [...APEX_OBJECT_SUFFIXES].sort(
		(a, b) => b.length - a.length,
	);
	return sortedSuffixes.find((suffix) => text.endsWith(suffix));
}
