/**
 * @file Complete list of standard Apex annotations and their option mappings. This file contains all standard Apex annotations that must be normalized to PascalCase.
 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation.htm}
 */

/**
 * Mapping of lowercase annotation names to their PascalCase equivalents.
 * These annotations should always be normalized to PascalCase.
 * Note: Apex annotations do not contain periods - namespaced constructs like Database.Batchable are interfaces, not annotations.
 */
const APEX_ANNOTATIONS: Record<string, string> = {
	auraenabled: 'AuraEnabled',
	// Continuation annotations
	continuation: 'Continuation',
	// Common annotations
	deprecated: 'Deprecated',
	future: 'Future',
	// HTTP annotations
	httpdelete: 'HttpDelete',
	httpget: 'HttpGet',
	httppatch: 'HttpPatch',
	httppost: 'HttpPost',
	httpput: 'HttpPut',
	invocablemethod: 'InvocableMethod',
	invocablevariable: 'InvocableVariable',
	istest: 'IsTest',
	jsonaccess: 'JsonAccess',
	// Managed package annotations
	managedpackage: 'ManagedPackage',
	namespaceaccessible: 'NamespaceAccessible',
	readonly: 'ReadOnly',
	remoteaction: 'RemoteAction',
	restresource: 'RestResource',
	// Streaming annotations
	streamingenabled: 'StreamingEnabled',
	suppresswarnings: 'SuppressWarnings',
	test: 'Test',
	// Test annotations
	testsetup: 'TestSetup',
	testvisible: 'TestVisible',
} as const;

/**
 * Represents an annotation option with its type and preferred casing.
 */
interface AnnotationOption {
	/** The type of the option value. */
	type: 'boolean' | 'string' | 'string[]';
	/** The preferred case for the option name (camelCase). */
	preferredCase: string;
}

/**
 * Mapping of lowercase annotation names to their available options.
 * Each option is keyed by lowercase name and contains type information and preferred casing.
 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation.htm}
 */
const APEX_ANNOTATION_OPTIONS: Record<
	string,
	Record<string, AnnotationOption>
> = {
	/**
	 * \@AuraEnabled annotation options.
	 * @param cacheable - Boolean indicating whether the method's return value can be cached on the client (API version 44.0+).
	 * @param continuation - Boolean indicating whether the method supports continuations for long-running callouts (must be true for methods that return a Continuation object).
	 * @param scope - String specifying the cache scope, valid value: 'global' (API version 55.0+, requires cacheable=true).
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_AuraEnabled.htm}
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/apex_continuations_auraenabled.htm}
	 */
	auraenabled: {
		cacheable: { preferredCase: 'Cacheable', type: 'boolean' },
		continuation: { preferredCase: 'Continuation', type: 'boolean' },
		scope: { preferredCase: 'Scope', type: 'string' },
	},

	/**
	 * \@Deprecated annotation options.
	 * No parameters - marks a method or class as deprecated.
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_deprecated.htm}
	 */
	deprecated: {},

	/**
	 * \@Future annotation options.
	 * @param callout - Boolean indicating whether the future method makes a callout to an external service.
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_future.htm}
	 */
	future: {
		callout: { preferredCase: 'Callout', type: 'boolean' },
	},

	/**
	 * \@HttpDelete annotation options.
	 * No parameters - indicates that the method handles HTTP DELETE requests (must be in a RestResource class).
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_http_delete.htm}
	 */
	httpdelete: {},

	/**
	 * \@HttpGet annotation options.
	 * No parameters - indicates that the method handles HTTP GET requests (must be in a RestResource class).
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_http_get.htm}
	 */
	httpget: {},

	/**
	 * \@HttpPatch annotation options.
	 * No parameters - indicates that the method handles HTTP PATCH requests (must be in a RestResource class).
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_http_patch.htm}
	 */
	httppatch: {},

	/**
	 * \@HttpPost annotation options.
	 * No parameters - indicates that the method handles HTTP POST requests (must be in a RestResource class).
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_http_post.htm}
	 */
	httppost: {},

	/**
	 * \@HttpPut annotation options.
	 * No parameters - indicates that the method handles HTTP PUT requests (must be in a RestResource class).
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_http_put.htm}
	 */
	httpput: {},

	/**
	 * \@InvocableMethod annotation options.
	 * @param label - String providing a label for the invocable method (default is the method name).
	 * @param description - String providing a description for the invocable method (default is Null).
	 * @param callout - Boolean indicating whether the method calls to an external system (default is false).
	 * @param capabilityType - String specifying the capability that integrates with the method (format: Name://Name, e.g., PromptTemplateType://SalesEmail).
	 * @param category - String specifying the category for the invocable method (default appears under Uncategorized).
	 * @param configurationEditor - String specifying the custom property editor registered with the method for Flow Builder.
	 * @param iconName - String specifying the name of the icon (SVG file from static resource or Salesforce Lightning Design System standard icon).
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableMethod.htm}
	 */
	invocablemethod: {
		callout: { preferredCase: 'Callout', type: 'boolean' },
		capabilitytype: { preferredCase: 'CapabilityType', type: 'string' },
		category: { preferredCase: 'Category', type: 'string' },
		configurationeditor: {
			preferredCase: 'ConfigurationEditor',
			type: 'string',
		},
		description: { preferredCase: 'Description', type: 'string' },
		iconname: { preferredCase: 'IconName', type: 'string' },
		label: { preferredCase: 'Label', type: 'string' },
	},

	/**
	 * \@InvocableVariable annotation options.
	 * @param label - String providing a label for the invocable variable (default is the variable name).
	 * @param description - String providing a description for the invocable variable (default is Null).
	 * @param defaultValue - String providing a default value for the action at runtime (valid format depends on data type: Boolean 'true'/'false', Decimal valid decimal, Double with 'd' suffix, Integer valid integer, Long with 'l' suffix, String any valid string).
	 * @param placeholderText - String providing examples or additional guidance about the invocable variable (valid for Double, Integer, String types).
	 * @param required - Boolean indicating whether the variable is required (default is false, ignored for output variables, throws error when used with defaultValue).
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableVariable.htm}
	 */
	invocablevariable: {
		defaultvalue: { preferredCase: 'DefaultValue', type: 'string' },
		description: { preferredCase: 'Description', type: 'string' },
		label: { preferredCase: 'Label', type: 'string' },
		placeholdertext: { preferredCase: 'PlaceholderText', type: 'string' },
		required: { preferredCase: 'Required', type: 'boolean' },
	},

	/**
	 * \@IsTest annotation options.
	 * @param seeAllData - Boolean indicating whether the test class or method has access to all data in the organization.
	 * @param isParallel - Boolean indicating whether the test class can run in parallel with other tests.
	 * @param onInstall - Boolean indicating whether the test method should be executed during package installation.
	 * Note: seeAllData and isParallel cannot be used together on the same method.
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_isTest.htm}
	 */
	istest: {
		isparallel: { preferredCase: 'IsParallel', type: 'boolean' },
		oninstall: { preferredCase: 'OnInstall', type: 'boolean' },
		seealldata: { preferredCase: 'SeeAllData', type: 'boolean' },
	},

	/**
	 * \@JsonAccess annotation options.
	 * @param serializable - String defining contexts in which the class can be serialized. Valid values: 'never', 'sameNamespace', 'samePackage', 'always'.
	 * @param deserializable - String defining contexts in which the class can be deserialized. Valid values: 'never', 'sameNamespace', 'samePackage', 'always'.
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_JsonAccess.htm}
	 */
	jsonaccess: {
		deserializable: { preferredCase: 'Deserializable', type: 'string' },
		serializable: { preferredCase: 'Serializable', type: 'string' },
	},

	/**
	 * \@NamespaceAccessible annotation options.
	 * No parameters - allows access to the class or method across namespaces.
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_NamespaceAccessible.htm}
	 */
	namespaceaccessible: {},

	/**
	 * \@ReadOnly annotation options.
	 * No parameters - allows methods to perform unrestricted queries against the Salesforce database.
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_ReadOnly.htm}
	 */
	readonly: {},

	/**
	 * \@RemoteAction annotation options.
	 * No parameters - exposes methods to be called from JavaScript in Visualforce pages.
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_RemoteAction.htm}
	 */
	remoteaction: {},

	/**
	 * \@RestResource annotation options.
	 * @param urlMapping - String specifying the URL mapping for the RESTful web service (required).
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_rest_resource.htm}
	 */
	restresource: {
		urlmapping: { preferredCase: 'UrlMapping', type: 'string' },
	},

	/**
	 * \@SuppressWarnings annotation options.
	 * @param value - String array of warning types to suppress (e.g., 'PMD.UnusedLocalVariable').
	 * Note: In Apex, use single quotes for string values: \@SuppressWarnings('PMD').
	 * For multiple values in Apex, use comma-separated string: \@SuppressWarnings('PMD.UnusedLocalVariable, PMD.UnusedPrivateMethod').
	 * Unlike Java, Apex does not use array syntax for multiple values.
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_SuppressWarnings.htm}
	 * @see {@link https://pmd.github.io/pmd/pmd_userdocs_suppressing_warnings.html}
	 */
	suppresswarnings: {
		value: { preferredCase: 'Value', type: 'string[]' },
	},

	/**
	 * \@TestSetup annotation options.
	 * No parameters - indicates that the method is a test setup method, which creates test data for test methods in the class.
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_testsetup.htm}
	 */
	testsetup: {},

	/**
	 * \@TestVisible annotation options.
	 * No parameters - allows test methods to access private or protected members of a class.
	 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_testvisible.htm}
	 */
	testvisible: {},
} as const;

/**
 * Lookup table for annotation option names (lowercase to preferred case).
 * This allows normalization of option names to their preferred casing.
 */
const APEX_ANNOTATION_OPTION_NAMES: Record<
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
 * Array of annotation keys (lowercase).
 * Derived from APEX_ANNOTATIONS keys to avoid duplication.
 */
const APEX_ANNOTATION_KEYS: readonly string[] = Object.keys(
	APEX_ANNOTATIONS,
) as readonly string[];

/**
 * Annotations that are valid on methods only.
 * Some annotations require specific method signatures (e.g., \@Future requires static void).
 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation.htm}
 */
const METHOD_ONLY_ANNOTATIONS = [
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
 * HTTP method annotations (must be in RestResource class).
 */
const HTTP_METHOD_ANNOTATIONS = [
	'httpdelete',
	'httpget',
	'httppatch',
	'httppost',
	'httpput',
] as const;

/**
 * Annotations that are valid on classes only.
 */
const CLASS_ONLY_ANNOTATIONS = ['istest', 'test', 'managedpackage'] as const;

/**
 * RestResource annotation (requires a URL mapping parameter).
 */
const REST_RESOURCE_ANNOTATION = 'restresource' as const;

/**
 * Annotations that can be used on both methods and classes.
 */
const BOTH_METHOD_AND_CLASS_ANNOTATIONS = [
	'deprecated',
	'suppresswarnings',
	'namespaceaccessible',
] as const;

export {
	APEX_ANNOTATIONS,
	APEX_ANNOTATION_OPTIONS,
	APEX_ANNOTATION_OPTION_NAMES,
	APEX_ANNOTATION_KEYS,
	METHOD_ONLY_ANNOTATIONS,
	HTTP_METHOD_ANNOTATIONS,
	CLASS_ONLY_ANNOTATIONS,
	REST_RESOURCE_ANNOTATION,
	BOTH_METHOD_AND_CLASS_ANNOTATIONS,
};
export type { AnnotationOption };
