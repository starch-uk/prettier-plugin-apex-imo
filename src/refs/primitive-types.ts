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

/**
 * Array of primitive and collection type keys (lowercase)
 * Used to check if a matched type should always be normalized regardless of context
 * Derived from PRIMITIVE_AND_COLLECTION_TYPES keys to avoid duplication.
 */
const PRIMITIVE_AND_COLLECTION_TYPE_KEYS: readonly string[] = Object.keys(
	PRIMITIVE_AND_COLLECTION_TYPES,
) as readonly string[];

/**
 * Get variable name for a type (helper for generating test variable names).
 * @param lowercaseType - The type name in lowercase format (e.g., 'string', 'integer').
 * @param [collectionType] - Optional collection type context. Must be one of: 'list', 'map', or 'set'.
 * @returns A variable name appropriate for the type.
 * @example
 * ```typescript
 * getVarNameForType('string', 'list'); // Returns 'strings'
 * getVarNameForType('id', 'map'); // Returns 'idMap'
 * ```
 */
function getVarNameForType(
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
 * Get primitive types (excluding collection types).
 * @returns Array of lowercase primitive type names.
 * @example
 * ```typescript
 * getPrimitiveTypes(); // Returns ['blob', 'boolean', 'date', ...]
 * ```
 */
function getPrimitiveTypes(): string[] {
	return PRIMITIVE_AND_COLLECTION_TYPE_KEYS.filter(
		(key) => !['list', 'set', 'map', 'sobject'].includes(key),
	);
}

/**
 * Get collection types only.
 * @returns Array of lowercase collection type names.
 * @example
 * ```typescript
 * getCollectionTypes(); // Returns ['list', 'set', 'map']
 * ```
 */
function getCollectionTypes(): string[] {
	return ['list', 'set', 'map'];
}

/**
 * Constants for magic numbers used in test value generation.
 */
const magicNumbers = {
	one: 1,
	thousand: 1000,
	two: 2,
	year: 2024,
	zero: 0,
} as const;

/**
 * Generate a test value for a primitive type.
 * @param type - The lowercase type name.
 * @param [index] - Optional index for generating different values (default: 0).
 * @returns A string representation of a test value for the given type.
 * @example
 * ```typescript
 * generateTestValue('string', 0); // Returns "'value0'"
 * generateTestValue('integer', 1); // Returns "2"
 * ```
 */
function generateTestValue(
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

export {
	PRIMITIVE_AND_COLLECTION_TYPES,
	PRIMITIVE_AND_COLLECTION_TYPE_KEYS,
	getVarNameForType,
	getPrimitiveTypes,
	getCollectionTypes,
	generateTestValue,
};
