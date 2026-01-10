/**
 * @file Utility functions for working with Apex AST nodes.
 */

import type { ApexNode } from './types.js';

const getNodeClass = (node: Readonly<ApexNode>): string => node['@class'];

const getNodeClassOptional = (node: Readonly<ApexNode>): string | undefined => {
	const cls = node['@class'];
	return typeof cls === 'string' ? cls : undefined;
};

/**
 * Creates a type guard factory for AST nodes based on class name.
 * @param className - The exact class name to match, or a function that checks the class name.
 * @returns A type guard function.
 */
const createNodeClassGuard = <T extends ApexNode>(
	className: string | ((cls: string | undefined) => boolean),
) => {
	const checkClass =
		typeof className === 'string'
			? (cls: string | undefined) => cls === className
			: className;

	return (
		node: Readonly<ApexNode> | null | undefined,
	): node is Readonly<T> => {
		if (!node || typeof node !== 'object') return false;
		const nodeClass = getNodeClassOptional(node);
		return checkClass(nodeClass) ?? false;
	};
};

export { getNodeClass, getNodeClassOptional, createNodeClassGuard };
