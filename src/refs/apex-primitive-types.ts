/**
 * Complete list of Apex primitive and collection types
 * Reference: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_primitive_data_types.htm
 * This file contains all primitive types and collection types that must be normalized to PascalCase
 */

/**
 * Mapping of lowercase primitive and collection type names to their PascalCase equivalents
 * These types should always be normalized to PascalCase regardless of context
 */
export const PRIMITIVE_AND_COLLECTION_TYPES: Record<string, string> = {
	// Primitive types
	string: 'String',
	integer: 'Integer',
	boolean: 'Boolean',
	decimal: 'Decimal',
	double: 'Double',
	long: 'Long',
	date: 'Date',
	datetime: 'Datetime',
	time: 'Time',
	blob: 'Blob',
	id: 'ID',
	object: 'Object',
	// Collection types
	list: 'List',
	set: 'Set',
	map: 'Map',
	// Salesforce-specific types
	sobject: 'SObject',
} as const;

/**
 * Array of primitive and collection type keys (lowercase)
 * Used to check if a matched type should always be normalized regardless of context
 * Derived from PRIMITIVE_AND_COLLECTION_TYPES keys to avoid duplication
 */
export const PRIMITIVE_AND_COLLECTION_TYPE_KEYS: readonly string[] =
	Object.keys(PRIMITIVE_AND_COLLECTION_TYPES) as readonly string[];

/**
 * Get variable name for a type (helper for generating test variable names)
 * @param lowercaseType - The lowercase type name
 * @param collectionType - Optional collection type context
 * @returns A variable name appropriate for the type
 */
export function getVarNameForType(
	lowercaseType: string,
	collectionType?: 'list' | 'map' | 'set',
): string {
	if (lowercaseType === 'id') {
		return collectionType === 'map' ? 'idMap' : 'ids';
	}
	if (lowercaseType === 'sobject') {
		return collectionType === 'map' ? 'sobjectMap' : 'records';
	}
	return collectionType === 'map'
		? `${lowercaseType}Map`
		: `${lowercaseType}s`;
}

/**
 * Get primitive types (excluding collection types)
 * @returns Array of lowercase primitive type names
 */
export function getPrimitiveTypes(): string[] {
	return PRIMITIVE_AND_COLLECTION_TYPE_KEYS.filter(
		(key) => !['list', 'set', 'map', 'sobject'].includes(key),
	);
}

/**
 * Get collection types only
 * @returns Array of lowercase collection type names
 */
export function getCollectionTypes(): string[] {
	return ['list', 'set', 'map'];
}

/**
 * Constants for magic numbers used in test value generation
 */
const magicNumbers = {
	zero: 0,
	one: 1,
	two: 2,
	thousand: 1000,
	year: 2024,
} as const;

/**
 * Generate a test value for a primitive type
 * @param type - The lowercase type name
 * @param index - Optional index for generating different values (default: 0)
 * @returns A string representation of a test value for the given type
 */
export function generateTestValue(
	type: string,
	index: number = magicNumbers.zero,
): string {
	const indexPlusOne = index + magicNumbers.one;
	const indexStr = String(index);
	const indexPlusOneStr = String(indexPlusOne);
	const indexTimesThousand =
		(index + magicNumbers.one) * magicNumbers.thousand;
	const indexTimesThousandStr = String(indexTimesThousand);
	const yearStr = String(magicNumbers.year);
	const zeroStr = String(magicNumbers.zero);

	switch (type) {
		case 'string':
			return `'value${indexStr}'`;
		case 'integer':
			return indexPlusOneStr;
		case 'boolean':
			return index % magicNumbers.two === magicNumbers.zero
				? 'true'
				: 'false';
		case 'decimal':
			return `${indexPlusOneStr}.${indexPlusOneStr}`;
		case 'double':
			return `${indexPlusOneStr}.${indexPlusOneStr}`;
		case 'long':
			return `${indexTimesThousandStr}L`;
		case 'date':
			return `Date.newInstance(${yearStr}, ${indexPlusOneStr}, ${indexPlusOneStr})`;
		case 'datetime':
			return `Datetime.newInstance(${yearStr}, ${indexPlusOneStr}, ${indexPlusOneStr})`;
		case 'time':
			return `Time.newInstance(${indexStr}, ${indexStr}, ${indexStr}, ${zeroStr})`;
		case 'blob':
			return `Blob.valueOf('test${indexStr}')`;
		case 'id':
			return `'00${indexStr}00000000000${indexStr}'`;
		case 'object': {
			// Handle different index values for object type
			const normalizedIndex = index;
			if (normalizedIndex === magicNumbers.zero) {
				return '1';
			}
			if (normalizedIndex === magicNumbers.one) {
				return "'two'";
			}
			return 'true';
		}
		default:
			return `'value${indexStr}'`;
	}
}
