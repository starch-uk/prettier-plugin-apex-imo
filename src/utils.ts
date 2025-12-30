import type { ApexNode, ApexListInitNode, ApexMapInitNode } from './types.js';

/**
 * Check if node is a List or Set literal initializer
 */
export function isListInit(node: ApexNode): node is ApexListInitNode {
	const nodeClass = node['@class'];
	return (
		nodeClass === 'apex.jorje.data.ast.NewObject$NewListLiteral' ||
		nodeClass === 'apex.jorje.data.ast.NewObject$NewSetLiteral'
	);
}

/**
 * Check if node is a Map literal initializer
 */
export function isMapInit(node: ApexNode): node is ApexMapInitNode {
	return node['@class'] === 'apex.jorje.data.ast.NewObject$NewMapLiteral';
}

/**
 * Check if a List/Set has multiple entries (2+)
 */
export function hasMultipleListEntries(node: ApexListInitNode): boolean {
	return Array.isArray(node.values) && node.values.length >= 2;
}

/**
 * Check if a Map has multiple entries (2+)
 */
export function hasMultipleMapEntries(node: ApexMapInitNode): boolean {
	return Array.isArray(node.pairs) && node.pairs.length >= 2;
}

/**
 * Determine if this node should be forced to multiline
 */
export function shouldForceMultiline(node: ApexNode): boolean {
	if (isListInit(node)) {
		return hasMultipleListEntries(node);
	}
	if (isMapInit(node)) {
		return hasMultipleMapEntries(node);
	}
	return false;
}
