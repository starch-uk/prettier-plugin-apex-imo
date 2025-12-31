/**
 * Complete list of standard Apex annotations
 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation.htm
 * This file contains all standard Apex annotations that must be normalized to PascalCase
 */

/**
 * Mapping of lowercase annotation names to their PascalCase equivalents
 * These annotations should always be normalized to PascalCase
 * Note: Apex annotations do not contain periods - namespaced constructs like
 * Database.Batchable are interfaces, not annotations
 */
export const APEX_ANNOTATIONS: Record<string, string> = {
	// Common annotations
	deprecated: 'Deprecated',
	test: 'Test',
	istest: 'IsTest',
	auraenabled: 'AuraEnabled',
	future: 'Future',
	readonly: 'ReadOnly',
	invocablemethod: 'InvocableMethod',
	invocablevariable: 'InvocableVariable',
	namespaceaccessible: 'NamespaceAccessible',
	remoteaction: 'RemoteAction',
	suppresswarnings: 'SuppressWarnings',
	// HTTP annotations
	httpdelete: 'HttpDelete',
	httpget: 'HttpGet',
	httppatch: 'HttpPatch',
	httppost: 'HttpPost',
	httpput: 'HttpPut',
	restresource: 'RestResource',
	// Test annotations
	testsetup: 'TestSetup',
	testvisible: 'TestVisible',
	// Streaming annotations
	streamingenabled: 'StreamingEnabled',
	// Continuation annotations
	continuation: 'Continuation',
	// Managed package annotations
	managedpackage: 'ManagedPackage',
} as const;

/**
 * Array of annotation keys (lowercase)
 * Derived from APEX_ANNOTATIONS keys to avoid duplication
 */
export const APEX_ANNOTATION_KEYS: readonly string[] = Object.keys(
	APEX_ANNOTATIONS,
) as readonly string[];

/**
 * Annotations that are valid on methods only
 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation.htm
 * Some annotations require specific method signatures (e.g., @Future requires static void)
 */
export const METHOD_ONLY_ANNOTATIONS = [
	'future',
	'auraenabled',
	'invocablemethod',
	'remoteaction',
	'readonly',
	'testsetup',
	'continuation',
	'streamingenabled',
] as const;

/**
 * HTTP method annotations (must be in RestResource class)
 */
export const HTTP_METHOD_ANNOTATIONS = [
	'httpdelete',
	'httpget',
	'httppatch',
	'httppost',
	'httpput',
] as const;

/**
 * Annotations that are valid on classes only
 */
export const CLASS_ONLY_ANNOTATIONS = [
	'istest',
	'test',
	'managedpackage',
] as const;

/**
 * RestResource annotation (requires a URL mapping parameter)
 */
export const REST_RESOURCE_ANNOTATION = 'restresource' as const;

/**
 * Annotations that can be used on both methods and classes
 */
export const BOTH_METHOD_AND_CLASS_ANNOTATIONS = [
	'deprecated',
	'suppresswarnings',
	'namespaceaccessible',
] as const;
