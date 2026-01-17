/**
 * @file Functions for normalizing ApexDoc group annotation group names.
 */

import { APEXDOC_GROUP_NAMES } from './refs/apexdoc-annotations.js';

/**
 * Normalizes a group name to its proper case.
 * Maps lowercase group names (e.g., "class", "method") to their proper case (e.g., "Class", "Method").
 * @param groupName - The group name to normalize.
 * @returns The normalized group name, or the original if not in the mapping.
 * @example
 * ```typescript
 * normalizeGroupName('class'); // Returns 'Class'
 * normalizeGroupName('method'); // Returns 'Method'
 * normalizeGroupName('unknown'); // Returns 'unknown'
 * ```
 */
const normalizeGroupName = (groupName: string): string => {
	if (!groupName) {
		return groupName;
	}
	const lowerGroupName = groupName.toLowerCase();
	const mappedValue = APEXDOC_GROUP_NAMES[lowerGroupName];
	return mappedValue ?? groupName;
};

/**
 * Normalizes the group name in group annotation content.
 * Extracts the first word (group name) and normalizes it, preserving any description that follows.
 * @param content - The group annotation content (e.g., "class My description").
 * @returns The normalized content with proper case group name (e.g., "Class My description").
 * @example
 * ```typescript
 * normalizeGroupContent('class My description'); // Returns 'Class My description'
 * normalizeGroupContent('method'); // Returns 'Method'
 * ```
 */
const normalizeGroupContent = (content: string): string => {
	if (!content) {
		return content;
	}
	const contentTrimmed = content.trim();
	const ZERO_INDEX = 0;
	const SPACE_CHAR = ' ';
	const OFFSET_ONE = 1;
	const firstSpaceIndex = contentTrimmed.indexOf(SPACE_CHAR);
	const groupName =
		firstSpaceIndex > ZERO_INDEX
			? contentTrimmed.substring(ZERO_INDEX, firstSpaceIndex)
			: contentTrimmed;
	const description =
		firstSpaceIndex > ZERO_INDEX
			? contentTrimmed.substring(firstSpaceIndex + OFFSET_ONE)
			: '';

	const normalizedGroupName = normalizeGroupName(groupName);

	if (description.length > ZERO_INDEX) {
		return `${normalizedGroupName} ${description}`;
	}
	return normalizedGroupName;
};

export { normalizeGroupContent };
