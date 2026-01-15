/**
 * @file Functions for normalizing ApexDoc @group annotation group names.
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
	const mappedValue =
		APEXDOC_GROUP_NAMES[lowerGroupName];
	return mappedValue !== undefined ? mappedValue : groupName;
};

/**
 * Normalizes the group name in @group annotation content.
 * Extracts the first word (group name) and normalizes it, preserving any description that follows.
 * @param content - The @group annotation content (e.g., "class My description").
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
	const firstSpaceIndex = contentTrimmed.indexOf(' ');
	const groupName =
		firstSpaceIndex > 0
			? contentTrimmed.substring(0, firstSpaceIndex)
			: contentTrimmed;
	const description =
		firstSpaceIndex > 0
			? contentTrimmed.substring(firstSpaceIndex + 1)
			: '';

	const normalizedGroupName = normalizeGroupName(groupName);

	if (description.length > 0) {
		return `${normalizedGroupName} ${description}`;
	}
	return normalizedGroupName;
};

export { normalizeGroupContent };
