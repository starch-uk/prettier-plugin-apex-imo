/**
 * @file Complete list of Salesforce object type suffixes. Reference: https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_list.htm. This file contains all standard Salesforce object type suffixes.
 */

/* eslint-disable @typescript-eslint/naming-convention -- Salesforce suffixes must maintain their exact format with underscores */

/**
 * Record of Salesforce object type suffixes
 * These suffixes are used to identify different types of Salesforce objects in type declarations
 * Keys are lowercase versions of the suffixes for fast lookup, values are the original case-sensitive suffixes.
 */
export const APEX_OBJECT_SUFFIXES: Record<string, string> = {
	__b: '__b', // Big object
	__c: '__c', // Custom object
	__changeevent: '__ChangeEvent', // Custom Object Change Event
	__chn: '__chn', // PlatformEventChannel
	__cio: '__cio', // Calculated insight object
	__datacategoryselection: '__DataCategorySelection', // Knowledge__DataCategorySelection
	__dg: '__dg', // Data graph
	__dlm: '__dlm', // Data Model Object (DMOs used for queries have this extension)
	__dlo: '__dlo', // Data Lake Object
	__dmo: '__dmo', // Data Model Object
	__dso: '__dso', // Data source object
	__e: '__e', // Platform event
	__feed: '__Feed', // Knowledge article feed or custom object feed
	__hd: '__hd', // Historical data
	__history: '__History', // Field History Tracking for custom objects
	__ka: '__ka', // Knowledge article
	__kav: '__kav', // Knowledge article version
	__latitude__s: '__latitude__s', // Geolocation custom field with latitude coordinates
	__longitude__s: '__longitude__s', // Geolocation custom field with longitude coordinates
	__mdt: '__mdt', // Custom metadata type
	__pc: '__pc', // Custom person account field
	__pr: '__pr', // Person account relationship field
	__r: '__r', // Custom relationship field as used in a SOQL query to traverse the relationship
	__share: '__Share', // Custom object sharing object
	__tag: '__Tag', // Salesforce tags
	__viewstat: '__ViewStat', // KnowledgeArticleViewStat
	__votestat: '__VoteStat', // KnowledgeArticleVoteStat
	__x: '__x', // External object
	__xo: '__xo', // Salesforce-to-Salesforce (S2S) spoke/proxy object
	_hst: '_hst', // A historical field for a custom report type
};
