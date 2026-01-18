/**
 * @file AstPath mock factories for testing.
 * Provides enhanced mock path creation with specialized contexts.
 */

import { vi } from 'vitest';
import type { AstPath } from 'prettier';
import type { ApexNode } from '../../src/types.js';

/**
 * Creates a mock AstPath for testing.
 * @param node - The Apex node to create a mock path for.
 * @param key - Optional key for the path.
 * @param stack - Optional stack for the path.
 * @returns A mock AST path for the given node.
 * @example
 * ```typescript
 * const path = createMockPath(mockNode);
 * const pathWithKey = createMockPath(mockNode, 'type');
 * const pathWithStack = createMockPath(mockNode, undefined, [parentNode]);
 * ```
 */
function createMockPath(
	node: Readonly<ApexNode>,
	key?: Readonly<number | string>,
	stack?: Readonly<readonly unknown[]>,
): AstPath<ApexNode> {
	const stackValue = stack ?? [];
	const mockPath = {
		call: vi.fn(() => ''),
		key,
		map: vi.fn(() => []),
		node,
		stack: stackValue,
	};
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mock factory for testing
	return mockPath as unknown as AstPath<ApexNode>;
}

/**
 * Creates a mock AstPath in type context.
 * @param node - The Apex node.
 * @returns A mock path with key='type'.
 */
function createMockTypePath(node: Readonly<ApexNode>): AstPath<ApexNode> {
	return createMockPath(node, 'type');
}

/**
 * Creates a mock AstPath in types array context.
 * @param node - The Apex node.
 * @returns A mock path with key='types'.
 */
function createMockTypesPath(node: Readonly<ApexNode>): AstPath<ApexNode> {
	return createMockPath(node, 'types');
}

/**
 * Creates a mock AstPath in names array context.
 * @param node - The Apex node.
 * @returns A mock path with key='names'.
 */
function createMockNamesPath(node: Readonly<ApexNode>): AstPath<ApexNode> {
	return createMockPath(node, 'names');
}

/**
 * Creates a mock AstPath in array index context for testing.
 * @param node - The Apex node to create a path for.
 * @param index - The numeric array index to use as the path key.
 * @returns A mock path with the specified node and numeric key.
 */
function createMockArrayPath(
	node: Readonly<ApexNode>,
	index: Readonly<number>,
): AstPath<ApexNode> {
	return createMockPath(node, index);
}

/**
 * Creates a mock AstPath with parent in stack for testing.
 * @param node - The Apex node to create a path for.
 * @param parent - The parent node to include in the path stack.
 * @param key - Optional key identifier for the path.
 * @returns A mock path with the specified node, parent in stack, and optional key.
 */
function createMockPathWithParent(
	node: Readonly<ApexNode>,
	parent: Readonly<ApexNode>,
	key?: Readonly<number | string>,
): AstPath<ApexNode> {
	return createMockPath(node, key, [parent]);
}

/**
 * Creates a mock AstPath in type context with parent.
 * @param node - The Apex node.
 * @param parent - The parent node.
 * @returns A mock path with key='type' and parent in stack.
 */
function createMockTypePathWithParent(
	node: Readonly<ApexNode>,
	parent: Readonly<ApexNode>,
): AstPath<ApexNode> {
	return createMockPathWithParent(node, parent, 'type');
}

// Export all functions in a single export declaration
export {
	createMockArrayPath,
	createMockNamesPath,
	createMockPath,
	createMockPathWithParent,
	createMockTypePath,
	createMockTypePathWithParent,
	createMockTypesPath,
};
