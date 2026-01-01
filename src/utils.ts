/**
 * @file Utility functions for working with Apex AST nodes.
 */

import type { ApexNode } from './types.js';

const getNodeClass = (node: Readonly<ApexNode>): string => node['@class'];

const getNodeClassOptional = (node: Readonly<ApexNode>): string | undefined => {
	const cls = node['@class'];
	return typeof cls === 'string' ? cls : undefined;
};

export { getNodeClass, getNodeClassOptional };
