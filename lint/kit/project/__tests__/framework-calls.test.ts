import { describe, expect, test } from 'vitest';

import { child, childList, isNode, nodeStart } from '../ast.js';
import type { AstNode } from '../ast.js';
import { diskCallOf, goldenOf, scenarioCallbackOf } from '../framework-calls.js';
import { parseProgram } from '../module-parser.js';

function expressionsOf(...sources: string[]): AstNode[] {
    const program = parseProgram('a.test.ts', sources.join('\n'));
    return (isNode(program) ? childList(program, 'body') : []).flatMap(
        (statement) => child(statement, 'expression') ?? [],
    );
}

function read(call: AstNode | undefined): string[] | undefined {
    const disk = diskCallOf(call);
    return disk === undefined
        ? undefined
        : [disk.kind, String(disk.path), String(nodeStart(disk.node))];
}

describe('framework-calls', () => {
    test('scenarioCallbackOf — the function a scenario action runs, as its last argument', () => {
        // Given - each scenario action with a callback, a non-function last argument, and calls that are no scenario
        const calls = expressionsOf(
            "website.visit('/', async (page) => {});",
            "mobile.open('home', function (screen) {});",
            'component.render(view, () => {});',
            "website.visit('/', options);",
            "website.visit('/', () => {}, options);",
            "website.fetch('/', () => {});",
            'visit(() => {});',
            "website['visit']('/', () => {});",
        );

        // Then - the callbacks of the three actions
        expect(calls.map((call) => scenarioCallbackOf(call)?.type)).toStrictEqual([
            'ArrowFunctionExpression',
            'FunctionExpression',
            'ArrowFunctionExpression',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
        ]);
    });

    test('diskCallOf and goldenOf — a bare file() or directory() call, and the one a toMatch compares to', () => {
        // Given - disk calls, a result accessor, a construction, and goldens with and without one
        const calls = expressionsOf(
            "file('./__expected__/a.json');",
            "directory('./__fixtures__/tree/');",
            'file();',
            "result.file('./a.json');",
            "new file('./a.json');",
            "expect(a).toMatch(file('./__expected__/b.json'));",
            'expect(a).toMatch(other);',
            "expect(a).toBe(file('./__expected__/c.json'));",
        );

        // Then - each call read, and each golden
        expect([
            calls.map((call) => read(call)),
            calls.map((call) => goldenOf(call)?.path),
        ]).toStrictEqual([
            [
                ['file', './__expected__/a.json', '5'],
                ['directory', './__fixtures__/tree/', '41'],
                ['file', 'undefined', '66'],
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            ],
            [
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                './__expected__/b.json',
                undefined,
                undefined,
            ],
        ]);
    });
});
