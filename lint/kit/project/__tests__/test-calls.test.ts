import type { Comment } from '@oxlint/plugins';
import { describe, expect, test } from 'vitest';

import { child, childList, isNode } from '../ast.js';
import type { AstNode } from '../ast.js';
import { parseProgram } from '../module-parser.js';
import {
    calleeOf,
    escapedFor,
    findTestCallback,
    firstArgumentOf,
    firstMarkerAt,
    groupBodyOf,
    hasMarker,
    isGroup,
    isTest,
    markerComments,
    testCalleeHasModifier,
    testName,
} from '../test-calls.js';

function statementsOf(source: string): AstNode[] {
    const program = parseProgram('a.test.ts', source);
    return isNode(program) ? childList(program, 'body') : [];
}

function statementOf(source: string): AstNode {
    const [statement] = statementsOf(source);
    if (statement === undefined) {
        throw new Error(`no statement in ${source}`);
    }
    return statement;
}

// invariant: a template hole, spelled so the templates of this file do not read it as one.
const HOLE = ['$', '{x}'].join('');

function callbackOf(statement: AstNode | undefined): string | undefined {
    return findTestCallback(childList(child(statement, 'expression'), 'arguments'))?.type;
}

const comment = (value: string, start: number): Comment => ({
    end: start + value.length,
    loc: { end: { column: 0, line: 1 }, start: { column: 0, line: 1 } },
    range: [start, start + value.length],
    start,
    type: 'Line',
    value,
});

describe('test-calls', () => {
    test('isTest and isGroup — a test or describe call through any chain of modifiers, and nothing else', () => {
        // Given - statements of every shape a test or group is written in, and some that are neither
        const statements = [
            "test('a', () => {});",
            "it('a', () => {});",
            "test.only('a', () => {});",
            "test.skipIf(ci)('a', () => {});",
            "test.each([1])('a %s', () => {});",
            "describe('a', () => {});",
            "describe.skip('a', () => {});",
            "new test('a', () => {});",
            "check('a', () => {});",
            'test;',
            "(0, test)('a');",
        ].map((source) => statementOf(source));

        // Then - which is a test, and which a group
        expect(
            statements.map((statement) => [isTest(statement), isGroup(statement)]),
        ).toStrictEqual([
            [true, false],
            [true, false],
            [true, false],
            [true, false],
            [true, false],
            [false, true],
            [false, true],
            [false, false],
            [false, false],
            [false, false],
            [false, false],
        ]);
    });

    test('testCalleeHasModifier — a modifier anywhere along the callee chain', () => {
        // Given - callees with modifiers in each position
        const callees = [
            "test.only('a');",
            "test.skipIf(ci)('a');",
            "test.concurrent.only('a');",
            "test.only.concurrent('a');",
            "test('a');",
            "only('a');",
        ].map((source) => calleeOf(statementOf(source)));

        // Then - only where `only` is a member of the chain
        expect(callees.map((callee) => testCalleeHasModifier(callee, 'only'))).toStrictEqual([
            true,
            false,
            true,
            true,
            false,
            false,
        ]);
        const skipped = calleeOf(statementOf("test.skipIf(ci)('a');"));
        expect(testCalleeHasModifier(skipped, 'skipIf')).toBe(true);
    });

    test('testName, firstArgumentOf and findTestCallback — the literal title and the function a test runs', () => {
        // Given - tests with a literal title, a computed one, and callbacks of each kind
        const [literal, computed, classic] = statementsOf(
            [
                "test('a title', async () => {});",
                'test(name, () => {});',
                "test('c', function () {});",
            ].join('\n'),
        );

        // Then - the title when literal, and the callback whatever its form
        expect([
            testName(child(literal, 'expression') ?? literal ?? statementOf('x;')),
            testName(child(computed, 'expression') ?? statementOf('x;')),
            firstArgumentOf(computed ?? statementOf('x;'))?.type,
            callbackOf(literal),
            callbackOf(classic),
            findTestCallback([]),
        ]).toStrictEqual([
            'a title',
            undefined,
            'Identifier',
            'ArrowFunctionExpression',
            'FunctionExpression',
            undefined,
        ]);
    });

    test('groupBodyOf — the block a describe runs, and none of a describe with no block or of any other call', () => {
        // Given - a describe with a block body, one with an expression body, and a test
        const bodies = [
            "describe('a', () => { test('b', () => {}); });",
            "describe('a', () => test('b', () => {}));",
            "describe('a');",
            "test('a', () => {});",
        ].map((source) => groupBodyOf(statementOf(source))?.type);

        // Then - the block alone
        expect(bodies).toStrictEqual(['BlockStatement', undefined, undefined, undefined]);
    });

    test('markerComments — the Given, When and Then comments in source order, an unplaced one first, and the first placed one of each kind', () => {
        // Given - marker comments out of order, one with no offset, and comments that are no marker
        const markers = markerComments([
            comment(' Then - the result', 40),
            comment(' a note', 5),
            comment(' Given - the input', 0),
            comment(' When - it runs', -1),
            comment(' Given - unplaced', -1),
            comment('Given -no space', 20),
            comment(' Given- glued', 30),
        ]);

        // Then - the three in order, and the first offset of each kind
        expect([
            markers.map(({ marker, start }) => `${marker}@${start}`),
            hasMarker(markers, 'When'),
            hasMarker(markers, 'Then'),
            firstMarkerAt(markers, 'Given'),
            firstMarkerAt(markers, 'When'),
            firstMarkerAt(markers, 'Then'),
            hasMarker([], 'Given'),
        ]).toStrictEqual([
            ['When@-1', 'Given@-1', 'Given@0', 'Given@20', 'Then@40'],
            true,
            true,
            0,
            -1,
            40,
            false,
        ]);
    });

    test("escapedFor — a text written into a title keeps the title's own quotes, and a template its holes", () => {
        // Given - titles quoted each way
        const titles = ["test('a');", 'test("a");', 'test(`a`);'].map(
            (source) => firstArgumentOf(statementOf(source)) ?? statementOf('x;'),
        );

        // Then - backslashes and the delimiter escaped, and a template's hole too
        const text = `it's "a\\b" ${HOLE} \`y\``;
        expect(titles.map((title) => escapedFor(title, text))).toStrictEqual([
            `it\\'s "a\\\\b" ${HOLE} \`y\``,
            `it's \\"a\\\\b\\" ${HOLE} \`y\``,
            `it's "a\\\\b" \\${HOLE} \\\`y\\\``,
        ]);
    });
});
