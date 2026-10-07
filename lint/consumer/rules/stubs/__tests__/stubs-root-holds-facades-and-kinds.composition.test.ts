import { describe, expect, test } from 'vitest';

import { child, childList, isNode, walk } from '../../../../kit/project/ast.js';
import type { AstNode } from '../../../../kit/project/ast.js';
import { parseProgram } from '../../../../kit/project/module-parser.js';
import {
    composes,
    compositionNames,
    exportsByName,
    exportsDefault,
    namesComposition,
} from '../stubs-root-holds-facades-and-kinds.composition.js';

function statementsOf(source: string): AstNode[] {
    const program = parseProgram('world.stubs.ts', source);
    return isNode(program) ? childList(program, 'body') : [];
}

function expressionOf(source: string): AstNode | undefined {
    const [statement] = statementsOf(source);
    return child(statement, 'expression');
}

describe('stubs-root-holds-facades-and-kinds.composition', () => {
    test('exportsDefault and exportsByName — a default named in a list, by identifier or by string, and every other way of exporting by name', () => {
        // Given - each shape of export a facade may write
        const exports = [
            'export { world as default };',
            "export { world as 'default' };",
            'export { world, quiet as default };',
            'export { world };',
            "export * from './kinds.js';",
            "export * as kinds from './kinds.js';",
            'export const world = 1;',
            'export type { World } from "./world.js";',
            'export {};',
        ].map((source) => statementsOf(source)[0]);

        // Then - which list a default, and which export a name
        expect(
            exports.map((node) =>
                node === undefined ? 'unparsed' : [exportsDefault(node), exportsByName(node)],
            ),
        ).toStrictEqual([
            [true, false],
            [true, false],
            [true, true],
            [false, true],
            [false, true],
            [false, true],
            [false, true],
            [false, false],
            [false, false],
        ]);
    });

    test('compositionNames — what a facade imports from a sibling facade, and the functions it declares returning Stubs', () => {
        // Given - imports from facades and from a plain module, and builders typed every way
        const source = [
            "import { calm, storm } from './weather.stubs';",
            "import quiet from './quiet.stubs.ts';",
            "import * as all from './all.stubs.js';",
            "import { helper } from './helper.js';",
            'function world(): Stubs { return defineStubs({}); }',
            'function other(): Other { return 1; }',
            'function listed(): Stubs[] { return []; }',
            'function qualified(): kit.Stubs { return kit.world; }',
            'const arrow = (): Stubs => defineStubs({});',
            'const untyped = () => defineStubs({});',
            'const value: Stubs = defineStubs({});',
            'export default (): Stubs => defineStubs({});',
        ].join('\n');
        const names = new Set<string>();
        const program = parseProgram('world.stubs.ts', source);

        // When - every node is read
        if (isNode(program)) {
            walk(program, (node) => {
                compositionNames(node, names);
            });
        }

        // Then - the facade imports and the two builders, nothing else
        expect([...names].toSorted()).toStrictEqual([
            'all',
            'arrow',
            'calm',
            'quiet',
            'storm',
            'world',
        ]);
    });

    test('namesComposition — a default that is a composition or a call of its builder, and none that is anything else', () => {
        // Given - the compositions a facade knows, and defaults of each shape
        const names = new Set(['world', 'build']);
        const declarations = ['world', 'build()', 'other', 'other()', 'kit.build()', '1'].map(
            (source) => expressionOf(`${source};`),
        );

        // Then - only the known names, called or not
        expect([
            ...declarations.map((declaration) => namesComposition(declaration, names)),
            namesComposition(undefined, names),
        ]).toStrictEqual([true, true, false, false, false, false, false]);
    });

    test('composes — a defineStubs call or a with() call, and no other call or construction', () => {
        // Given - each shape of call
        const nodes = [
            'defineStubs({})',
            'world.with({})',
            'world["with"]({})',
            'other({})',
            'new defineStubs({})',
            'defineStubs',
        ].map((source) => expressionOf(`${source};`));

        // Then - the two that compose
        expect(nodes.map((node) => node !== undefined && composes(node))).toStrictEqual([
            true,
            true,
            false,
            false,
            false,
            false,
        ]);
    });
});
