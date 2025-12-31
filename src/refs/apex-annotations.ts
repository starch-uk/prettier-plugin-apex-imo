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
	jsonaccess: 'JsonAccess',
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
 * Represents an annotation option with its type and preferred casing
 */
export interface AnnotationOption {
	/** The type of the option value */
	type: 'boolean' | 'string' | 'string[]';
	/** The preferred case for the option name (camelCase) */
	preferredCase: string;
}

/**
 * Mapping of lowercase annotation names to their available options
 * Each option is keyed by lowercase name and contains type information and preferred casing
 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation.htm
 */
export const APEX_ANNOTATION_OPTIONS: Record<
	string,
	Record<string, AnnotationOption>
> = {
	/**
	 * @AuraEnabled annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_AuraEnabled.htm
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/apex_continuations_auraenabled.htm
	 * @param cacheable - Boolean indicating whether the method's return value can be cached on the client (API version 44.0+)
	 * @param continuation - Boolean indicating whether the method supports continuations for long-running callouts (must be true for methods that return a Continuation object)
	 * @param scope - String specifying the cache scope, valid value: 'global' (API version 55.0+, requires cacheable=true)
	 */
	auraenabled: {
		cacheable: { type: 'boolean', preferredCase: 'cacheable' },
		continuation: { type: 'boolean', preferredCase: 'continuation' },
		scope: { type: 'string', preferredCase: 'scope' },
	},
	/**
	 * @Deprecated annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_deprecated.htm
	 * No parameters - marks a method or class as deprecated
	 */
	deprecated: {},
	/**
	 * @Future annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_future.htm
	 * @param callout - Boolean indicating whether the future method makes a callout to an external service
	 */
	future: {
		callout: { type: 'boolean', preferredCase: 'callout' },
	},
	/**
	 * @InvocableMethod annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableMethod.htm
	 * @param label - String providing a label for the invocable method (default is the method name)
	 * @param description - String providing a description for the invocable method (default is Null)
	 * @param callout - Boolean indicating whether the method calls to an external system (default is false)
	 * @param capabilityType - String specifying the capability that integrates with the method (format: Name://Name, e.g., PromptTemplateType://SalesEmail)
	 * @param category - String specifying the category for the invocable method (default appears under Uncategorized)
	 * @param configurationEditor - String specifying the custom property editor registered with the method for Flow Builder
	 * @param iconName - String specifying the name of the icon (SVG file from static resource or Salesforce Lightning Design System standard icon)
	 */
	invocablemethod: {
		label: { type: 'string', preferredCase: 'label' },
		description: { type: 'string', preferredCase: 'description' },
		callout: { type: 'boolean', preferredCase: 'callout' },
		capabilitytype: { type: 'string', preferredCase: 'capabilityType' },
		category: { type: 'string', preferredCase: 'category' },
		configurationeditor: {
			type: 'string',
			preferredCase: 'configurationEditor',
		},
		iconname: { type: 'string', preferredCase: 'iconName' },
	},
	/**
	 * @InvocableVariable annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableVariable.htm
	 * @param label - String providing a label for the invocable variable (default is the variable name)
	 * @param description - String providing a description for the invocable variable (default is Null)
	 * @param defaultValue - String providing a default value for the action at runtime (valid format depends on data type: Boolean 'true'/'false', Decimal valid decimal, Double with 'd' suffix, Integer valid integer, Long with 'l' suffix, String any valid string)
	 * @param placeholderText - String providing examples or additional guidance about the invocable variable (valid for Double, Integer, String types)
	 * @param required - Boolean indicating whether the variable is required (default is false, ignored for output variables, throws error when used with defaultValue)
	 */
	invocablevariable: {
		label: { type: 'string', preferredCase: 'label' },
		description: { type: 'string', preferredCase: 'description' },
		defaultvalue: { type: 'string', preferredCase: 'defaultValue' },
		placeholdertext: { type: 'string', preferredCase: 'placeholderText' },
		required: { type: 'boolean', preferredCase: 'required' },
	},
	/**
	 * @IsTest annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_isTest.htm
	 * @param seeAllData - Boolean indicating whether the test class or method has access to all data in the organization
	 * @param isParallel - Boolean indicating whether the test class can run in parallel with other tests
	 * @param onInstall - Boolean indicating whether the test method should be executed during package installation
	 * Note: seeAllData and isParallel cannot be used together on the same method
	 */
	istest: {
		seealldata: { type: 'boolean', preferredCase: 'seeAllData' },
		isparallel: { type: 'boolean', preferredCase: 'isParallel' },
		oninstall: { type: 'boolean', preferredCase: 'onInstall' },
	},
	/**
	 * @JsonAccess annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_JsonAccess.htm
	 * @param serializable - String defining contexts in which the class can be serialized
	 *   Valid values: 'never', 'sameNamespace', 'samePackage', 'always'
	 * @param deserializable - String defining contexts in which the class can be deserialized
	 *   Valid values: 'never', 'sameNamespace', 'samePackage', 'always'
	 */
	jsonaccess: {
		serializable: { type: 'string', preferredCase: 'serializable' },
		deserializable: { type: 'string', preferredCase: 'deserializable' },
	},
	/**
	 * @NamespaceAccessible annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_NamespaceAccessible.htm
	 * No parameters - allows access to the class or method across namespaces
	 */
	namespaceaccessible: {},
	/**
	 * @ReadOnly annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_ReadOnly.htm
	 * No parameters - allows methods to perform unrestricted queries against the Salesforce database
	 */
	readonly: {},
	/**
	 * @RemoteAction annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_RemoteAction.htm
	 * No parameters - exposes methods to be called from JavaScript in Visualforce pages
	 */
	remoteaction: {},
	/**
	 * @SuppressWarnings annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_SuppressWarnings.htm
	 * Reference: https://pmd.github.io/pmd/pmd_userdocs_suppressing_warnings.html
	 * @param value - String array of warning types to suppress (e.g., 'PMD.UnusedLocalVariable')
	 * Note: In Apex, use single quotes for string values: @SuppressWarnings('PMD')
	 * For multiple values in Apex, use comma-separated string: @SuppressWarnings('PMD.UnusedLocalVariable, PMD.UnusedPrivateMethod')
	 * Unlike Java, Apex does not use array syntax for multiple values
	 */
	suppresswarnings: {
		value: { type: 'string[]', preferredCase: 'value' },
	},
	/**
	 * @TestSetup annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_testsetup.htm
	 * No parameters - indicates that the method is a test setup method, which creates test data for test methods in the class
	 */
	testsetup: {},
	/**
	 * @TestVisible annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_testvisible.htm
	 * No parameters - allows test methods to access private or protected members of a class
	 */
	testvisible: {},
	/**
	 * @RestResource annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_rest_resource.htm
	 * @param urlMapping - String specifying the URL mapping for the RESTful web service (required)
	 */
	restresource: {
		urlmapping: { type: 'string', preferredCase: 'urlMapping' },
	},
	/**
	 * @HttpDelete annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_http_delete.htm
	 * No parameters - indicates that the method handles HTTP DELETE requests (must be in a RestResource class)
	 */
	httpdelete: {},
	/**
	 * @HttpGet annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_http_get.htm
	 * No parameters - indicates that the method handles HTTP GET requests (must be in a RestResource class)
	 */
	httpget: {},
	/**
	 * @HttpPatch annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_http_patch.htm
	 * No parameters - indicates that the method handles HTTP PATCH requests (must be in a RestResource class)
	 */
	httppatch: {},
	/**
	 * @HttpPost annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_http_post.htm
	 * No parameters - indicates that the method handles HTTP POST requests (must be in a RestResource class)
	 */
	httppost: {},
	/**
	 * @HttpPut annotation options
	 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_http_put.htm
	 * No parameters - indicates that the method handles HTTP PUT requests (must be in a RestResource class)
	 */
	httpput: {},
} as const;

/**
 * Lookup table for annotation option names (lowercase to preferred case)
 * This allows normalization of option names to their preferred casing
 */
export const APEX_ANNOTATION_OPTION_NAMES: Record<
	string,
	Record<string, string>
> = ((): Record<string, Record<string, string>> => {
	const result: Record<string, Record<string, string>> = {};
	for (const [annotation, options] of Object.entries(
		APEX_ANNOTATION_OPTIONS,
	)) {
		const optionMap: Record<string, string> = {};
		for (const [key, option] of Object.entries(options)) {
			optionMap[key] = option.preferredCase;
		}
		result[annotation] = optionMap;
	}
	return result;
})();

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
