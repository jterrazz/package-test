import { describe, expect, test } from 'vitest';

import {
    chainRootName,
    child,
    childList,
    findProperty,
    identifierName,
    isNamedKey,
    isNode,
    isReference,
    isSampledValue,
    memberPath,
    memberPropertyName,
    nodeEnd,
    nodeStart,
    propertyKeyName,
    rootOf,
    specificationMember,
    stringField,
    stringValue,
    walk,
} from '../ast.js';
import type { AstNode } from '../ast.js';
import { parseProgram } from '../module-parser.js';

function propertiesOf(expression: string): AstNode[] {
    const program = parseProgram('value.ts', `const value = ${expression};`);
    const [statement] = isNode(program) ? childList(program, 'body') : [];
    return childList(child(childList(statement, 'declarations')[0], 'init'), 'properties');
}

function expressionOf(code: string): AstNode {
    const program = parseProgram('value.ts', `const value = ${code};`);
    const [statement] = isNode(program) ? childList(program, 'body') : [];
    const init = child(childList(statement, 'declarations')[0], 'init');
    if (init === undefined) {
        throw new Error(`no expression in ${code}`);
    }

    return init;
}

const NOTHING = child(expressionOf('x'), 'nothing');

const read = <T>(codes: readonly string[], reader: (node: AstNode) => T): T[] =>
    codes.map((code) => reader(expressionOf(code)));

describe('ast', () => {
    test('isNamedKey — a key is named when it is written as it is, never when it is computed', () => {
        // Given - a bare key, a string key and a computed one
        const keys = propertiesOf("{ root: 1, 'as-written': 2, [String(3)]: 3 }");

        // Then - the computed key runs an expression
        expect(keys.map(isNamedKey)).toStrictEqual([true, true, false]);
    });

    test('stringValue — reads a string literal or a template with no expression, nothing else', () => {
        // Given - literals, templates and a name
        const codes = ["'a'", '1', '`t`', `\`t\${'x'}\``, 'x'];

        // Then - only the two written strings read
        expect([...read(codes, stringValue), stringValue(NOTHING)]).toStrictEqual([
            'a',
            undefined,
            't',
            undefined,
            undefined,
            undefined,
        ]);
    });

    test('memberPropertyName and memberPath — name a member written as it is, never a computed one', () => {
        // Given - members, calls and names, and no node at all
        const names = ['a.b', 'a[b]', "a['b']", 'a', 'a.#b'];
        const paths = [
            'a',
            'a.b.c',
            'a.b()',
            'a.b(1)',
            'f()',
            'a[b].c',
            "'s'.length",
            '(1).x',
            'a[b]()',
        ];

        // Then - each written member, and each path of names and argument-less calls
        expect([
            read(names, memberPropertyName),
            read(paths, memberPath),
            memberPath(NOTHING),
            memberPropertyName(NOTHING),
        ]).toStrictEqual([
            ['b', undefined, undefined, undefined, undefined],
            ['a', 'a.b.c', 'a.b()', undefined, 'f()', undefined, undefined, undefined, undefined],
            undefined,
            undefined,
        ]);
    });

    test('chainRootName and rootOf — find the name a chain starts from, through calls, awaits and optional links', () => {
        // Given - chains of every link
        const chains = ['x.y(1).z', 'await x.y()', 'x?.y.z', '(a, b).c', 'f().b'];

        // Then - the first name, or none when the chain starts on no name
        expect([
            read(chains, chainRootName),
            chainRootName(NOTHING),
            read(['a.b.c', '(a satisfies X).b', 'f().b'], rootOf),
            rootOf(NOTHING),
        ]).toStrictEqual([
            ['x', 'x', 'x', undefined, 'f'],
            undefined,
            ['a', 'a', undefined],
            undefined,
        ]);
    });

    test('specificationMember — names the specification a specification call constructs', () => {
        // Given - the constructor and look-alikes
        const calls = [
            "specification.cli('./bin')",
            "other.cli('./bin')",
            "cli('./bin')",
            "a.specification.cli('./bin')",
            "specification['cli']('./bin')",
        ];

        // Then - the specification's own member alone
        expect(read(calls, specificationMember)).toStrictEqual([
            'cli',
            undefined,
            undefined,
            undefined,
            undefined,
        ]);
    });

    test('findProperty and propertyKeyName — read a key written as a name, a string or a number, never a computed key or a spread', () => {
        // Given - an object of every key, and a value that is no object
        const keys = propertiesOf("{ a: 1, 'b': 2, 3: 3, [c]: 4, ...d }");

        // Then - the three written keys
        expect([
            keys.map(propertyKeyName),
            findProperty(expressionOf('{ a: 1 }'), 'a')?.type,
            findProperty(expressionOf('[1]'), 'a'),
        ]).toStrictEqual([['a', 'b', '3', undefined, undefined], 'Property', undefined]);
    });

    test('isSampledValue — knows each reading that answers differently on the next run', () => {
        // Given - the samples and their pinned or foreign look-alikes
        const samples = [
            'new Date()',
            'Date.now()',
            'performance.now()',
            'Math.random()',
            'randomUUID()',
            'crypto.randomUUID()',
        ];
        const pinned = [
            'new Date(1)',
            'new Other()',
            'Date.now',
            'uuid.random()',
            'x[0]()',
            'randomUUIDs()',
            '1',
        ];

        // Then - every sample, and none of the rest
        expect([read(samples, isSampledValue), read(pinned, isSampledValue)]).toStrictEqual([
            [true, true, true, true, true, true],
            [false, false, false, false, false, false, false],
        ]);
    });

    test('isReference — a read of names and written members, through casts', () => {
        // Given - reads and what is none
        const codes = ['a', 'a.b', "a['b']", 'a[b]', 'f().b', '(a as X).b'];

        // Then - names and written members alone
        expect([read(codes, isReference), isReference(NOTHING)]).toStrictEqual([
            [true, true, true, false, false, true],
            false,
        ]);
    });

    test('the node primitives — positions, children, fields and names of what is and is not a node', () => {
        // Given - a node, and values that are not one
        const node = expressionOf('x');

        // Then - each primitive answers for both
        expect([
            nodeStart(NOTHING),
            nodeEnd(NOTHING),
            nodeEnd(node) > nodeStart(node),
            [isNode(null), isNode({}), isNode({ type: 1 }), isNode(node)],
            childList(expressionOf('[x, , y]'), 'elements').length,
            childList(node, 'name'),
            stringField(expressionOf('1'), 'value'),
            stringField(undefined, 'name'),
            identifierName(expressionOf("'x'")),
        ]).toStrictEqual([
            -1,
            -1,
            true,
            [false, false, false, true],
            2,
            [],
            undefined,
            undefined,
            undefined,
        ]);
    });

    test('walk — visits every child once, never back up through the parent', () => {
        // Given - a member whose parent is set, as the linter sets it
        const node = expressionOf('a.b');
        Reflect.set(node, 'parent', expressionOf('c'));
        const visited: string[] = [];

        // When - it is walked
        walk(node, (inner) => {
            visited.push(identifierName(inner) ?? inner.type);
        });

        // Then - the member and its two names, and not the parent's
        expect(visited).toStrictEqual(['MemberExpression', 'a', 'b']);
    });
});
