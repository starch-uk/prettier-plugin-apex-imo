/**
 * @file Complete list of Apex primitive and collection types. This file contains all primitive types and collection types that must be normalized to PascalCase.
 * @see {@link https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_primitive_data_types.htm}
 */

/**
 * Mapping of lowercase primitive and collection type names to their PascalCase equivalents
 * These types should always be normalized to PascalCase regardless of context.
 */
const PRIMITIVE_AND_COLLECTION_TYPES: Record<string, string> = {
	blob: 'Blob',
	boolean: 'Boolean',
	date: 'Date',
	datetime: 'Datetime',
	decimal: 'Decimal',
	double: 'Double',
	id: 'ID',
	integer: 'Integer',
	// Collection types
	list: 'List',
	long: 'Long',
	map: 'Map',
	object: 'Object',
	set: 'Set',
	// Salesforce-specific types
	sobject: 'SObject',
	// Primitive types
	string: 'String',
	time: 'Time',
} as const;

export { PRIMITIVE_AND_COLLECTION_TYPES };
