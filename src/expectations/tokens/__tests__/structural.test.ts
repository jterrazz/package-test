import { describe, expect, test } from 'vitest';

import { CaptureScope } from '../capture-scope.js';
import { match } from '../match.js';
import {
    renderExpected,
    structuralEquals,
    structuralSubset,
    textContains,
    textEquals,
} from '../structural.js';

const UUID_A = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';
const UUID_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('structural', () => {
    test('structural — capture equality — object captures compare by content, not key order', () => {
        // Given - the same object captured twice with different key orders
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('obj'), { a: 2, b: 1 }, scope)).toBe(true);

        // Then - a re-ordered but structurally identical object is equal
        expect(structuralEquals(match.ref('obj'), { b: 1, a: 2 }, scope)).toBe(true);
        expect(structuralEquals(match.ref('obj'), { a: 2, b: 99 }, scope)).toBe(false);
    });

    test('structural — capture equality — cross-context ref equality: 42 captured from JSON equals "42" from text', () => {
        // Given - a number captured from a JSON context
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('n'), 42, scope)).toBe(true);

        // Then - the string form captured from a text context is equal
        expect(structuralEquals('{{int#n}}', '42', scope)).toBe(true);
        expect(structuralEquals('{{int#n}}', '43', scope)).toBe(false);
    });

    test('structural — capture equality — a ref is shared across textEquals and structuralEquals on one scope', () => {
        // Given - a uuid captured through a text snapshot comparison
        const scope = new CaptureScope();
        expect(textEquals(`session {{uuid#s}} opened`, `session ${UUID_A} opened`, scope)).toBe(
            true,
        );

        // Then - the same ref constrains a structural comparison on that scope
        expect(structuralEquals({ id: match.ref('s') }, { id: UUID_A }, scope)).toBe(true);
        expect(structuralEquals({ id: match.ref('s') }, { id: UUID_B }, scope)).toBe(false);
    });

    test('structural — capture equality — ref(b, { not: "a" }) works in both directions; a never-captured "a" passes (pinned)', () => {
        // Given - "a" captured first
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('a'), UUID_A, scope)).toBe(true);

        // Then - b must differ from a, and a-vs-b symmetric usage also holds
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_A, scope)).toBe(false);
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_B, scope)).toBe(true);
        expect(structuralEquals(match.ref('c', { not: 'b' }), UUID_B, scope)).toBe(false);

        // Then - pinned: { not } against a never-captured ref does not constrain
        const fresh = new CaptureScope();
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_A, fresh)).toBe(true);
    });

    test('structural — whole and subset — a value equals another of the same shape, a subset allows keys it does not state, and a list asks the same length either way', () => {
        // Given - pairs of each shape: values, lists, objects, a token string, a plain string, a matcher
        const pairs: [unknown, unknown][] = [
            [{ a: 1 }, { a: 1 }],
            [{ a: 1 }, { a: 1, b: 2 }],
            [{ a: 1, b: 2 }, { a: 1 }],
            [{ a: 1 }, { b: 1 }],
            [{ a: { x: 1 } }, { a: { x: 1, y: 2 } }],
            [{ a: undefined }, { b: undefined }],
            [{ a: 1 }, [1]],
            [{ a: 1 }, null],
            [
                [1, 2],
                [1, 2],
            ],
            [
                [1, 2],
                [2, 1],
            ],
            [[1], [1, 2]],
            [[1], { 0: 1 }],
            [[{ a: 1 }], [{ a: 1, b: 2 }]],
            ['{{uuid}}', UUID_A],
            ['{{uuid}}', 'not an id'],
            ['plain', 'plain'],
            [match.any(), { anything: true }],
            [Number.NaN, Number.NaN],
            [0, -0],
        ];

        // Then - whether each is equal, and whether each is a subset
        expect(
            pairs.map(([expected, actual]) => [
                structuralEquals(expected, actual, new CaptureScope()),
                structuralSubset(expected, actual, new CaptureScope()),
            ]),
        ).toStrictEqual([
            [true, true],
            [false, true],
            [false, false],
            [false, false],
            [false, true],
            [false, false],
            [false, false],
            [false, false],
            [true, true],
            [false, false],
            [false, false],
            [false, false],
            [false, true],
            [true, true],
            [false, false],
            [true, true],
            [true, true],
            [true, true],
            [false, false],
        ]);
    });

    test('structural — text — a text without tokens equals itself alone, with tokens it is a pattern; contained, it is found anywhere', () => {
        // Given - texts plain, with characters a pattern reads, and tokened, one capture bound already
        const bound = new CaptureScope();
        textEquals('{{uuid#id}}', UUID_A, bound);

        // Then - each comparison
        expect([
            textEquals('a {{int}}', 'a 1', new CaptureScope()),
            textEquals('a {{int}}', 'a x', new CaptureScope()),
            textEquals('a.b', 'a.b', new CaptureScope()),
            textEquals('a.b', 'axb', new CaptureScope()),
            textContains('b {{int}}', 'a b 1 c', new CaptureScope()),
            textContains('b {{int}}', 'a b x c', new CaptureScope()),
            textContains('b.c', 'a b.c d', new CaptureScope()),
            textContains('b.c', 'a bxc d', new CaptureScope()),
            textContains('(a+) [b]', 'x (a+) [b] y', new CaptureScope()),
            textContains(`{{int}} {{uuid#id}}`, `x 1 ${UUID_A} y`, bound),
            textContains(`{{int}} {{uuid#id}}`, `x 1 ${UUID_B} y`, bound),
            textContains(`{{uuid#id}} {{int}}`, `x ${UUID_A} 1 y`, bound),
            textContains('{{int}} {{int}}', 'a 1 2', new CaptureScope()),
            renderExpected([match.any(), { a: [match.uuid()] }, 'x']),
        ]).toStrictEqual([
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            true,
            false,
            true,
            true,
            ['{{any}}', { a: ['{{uuid}}'] }, 'x'],
        ]);
    });
});
