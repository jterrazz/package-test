import { describe, expect, test } from 'vitest';

import { child, childList, isNode } from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import { parseProgram } from '../../reading/module-parser.js';
import { isAdapter, isNamedKey, isRow } from './facet-values.js';

function expressionOf(expression: string): AstNode | undefined {
    const program = parseProgram('value.ts', `const value = ${expression};`);
    const [statement] = isNode(program) ? childList(program, 'body') : [];
    return child(childList(statement, 'declarations')[0], 'init');
}

function propertiesOf(expression: string): AstNode[] {
    return childList(expressionOf(expression), 'properties');
}

describe('facet-values', () => {
    test('facet values — a key is named when it is written as it is, never when it is computed', () => {
        // Given - a bare key, a string key and a computed one
        const keys = propertiesOf("{ root: 1, 'as-written': 2, [String(3)]: 3 }");

        // Then - the computed key runs an expression
        expect(keys.map(isNamedKey)).toStrictEqual([true, true, false]);
    });

    test('facet values — a matrix row is string literals under keys written as they are', () => {
        // Given - a row of literals, one with a computed value, one with a computed key
        const rows = [
            "{ group: 'a', name: 'b' } as const",
            "{ group: 'a', name: String('b') }",
            "{ group: 'a', [String('name')]: 'b' }",
        ];

        // Then - a computed value or a computed key is no row
        expect(rows.map((row) => isRow(expressionOf(row)))).toStrictEqual([true, false, false]);
    });

    test("facet values — an adapter is a plain value or an engine's constructor called on plain values", () => {
        // Given - an engine's constructor and a definition
        const imports = new Map([
            ['databaseSet', '../../world/services/seed/database-set.engine.js'],
            ['seed', '../../world/services/seed/seed.capability.js'],
        ]);

        // Then - only the engine's builds an adapter, and only on plain values
        expect(isAdapter(expressionOf('databaseSet(config)'), imports)).toBe(true);
        expect(isAdapter(expressionOf('config.jobs ?? []'), imports)).toBe(true);
        expect(isAdapter(expressionOf('seed(config)'), imports)).toBe(false);
        expect(isAdapter(expressionOf('databaseSet(config.list.map(String))'), imports)).toBe(
            false,
        );
    });
});
