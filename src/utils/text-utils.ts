/**
 * Calculates the length of a comment prefix.
 * @param commentType - The type of comment ('apexdoc' or 'regular').
 * @param indentLevel - The base indentation level.
 * @param tabWidth - The tab width.
 * @param useTabs - Whether tabs are used for indentation.
 * @returns The total prefix length.
 */
export const calculateCommentPrefixLength = (
	commentType: 'apexdoc' | 'regular' = 'apexdoc',
	indentLevel: number = 0,
	tabWidth: number = DEFAULT_TAB_WIDTH,
	useTabs: boolean = false,
): number => {
	const baseIndent = createIndent(indentLevel, tabWidth, useTabs);

	switch (commentType) {
		case 'apexdoc':
			// ApexDoc format: indent + " * "
			return baseIndent.length + 3; // " * ".length = 3
		case 'regular':
			// Regular comment format: indent + " * "
			return baseIndent.length + 3; // " * ".length = 3
		default:
			return baseIndent.length + 3;
	}
};