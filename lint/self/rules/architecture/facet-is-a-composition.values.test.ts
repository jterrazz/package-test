import { describe, expect, test } from 'vitest';

import { child, childList, isNode } from '../../../engine/project/ast.js';
import type { AstNode } from '../../../engine/project/ast.js';
import { parseProgram } from '../../../engine/project/module-parser.js';
import { isAdapter, isRow } from './facet-is-a-composition.values.js';

function expressionOf(expression: string): AstNode | undefined {
    const program = parseProgram('value.ts', `const value = ${expression};`);
    const [statement] = isNode(program) ? childList(program, 'body') : [];
    return child(childList(statement, 'declarations')[0], 'init');
}

describe('facet-is-a-composition.values', () => {
    test('facet-values — facet values — a matrix row is string literals under keys written as they are', () => {
        // Given - a row of literals, one with a computed value, one with a computed key
        const rows = [
            "{ group: 'a', name: 'b' } as const",
            "{ group: 'a', name: String('b') }",
            "{ group: 'a', [String('name')]: 'b' }",
        ];

        // Then - a computed value or a computed key is no row
        expect(rows.map((row) => isRow(expressionOf(row)))).toStrictEqual([true, false, false]);
    });

    test("facet-values — facet values — an adapter is a plain value or a driver's constructor called on plain values", () => {
        // Given - a driver's constructor and a definition
        const imports = new Map([
            ['databaseSet', '../../world/services/seed/database-set.driver.js'],
            ['seed', '../../world/services/seed/seed.capability.js'],
        ]);

        // Then - only the driver's builds an adapter, and only on plain values
        expect(isAdapter(expressionOf('databaseSet(config)'), imports)).toBe(true);
        expect(isAdapter(expressionOf('config.jobs ?? []'), imports)).toBe(true);
        expect(isAdapter(expressionOf('seed(config)'), imports)).toBe(false);
        expect(isAdapter(expressionOf('databaseSet(config.list.map(String))'), imports)).toBe(
            false,
        );
    });
});
