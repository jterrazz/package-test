import { describe, expect, test } from 'vitest';

import { CaptureScope } from '../capture-scope.js';
import { match, Matcher } from '../match.js';
import {
    kindMatches,
    matcherMatches,
    placeholderStringMatches,
    recordRef,
} from '../placeholders.js';

const UUID_A = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';

/** A matcher from code, or a string written with `{{token}}` placeholders. */
const tokenMatches = (expected: unknown, actual: unknown, scope: CaptureScope): boolean =>
    expected instanceof Matcher
        ? matcherMatches(expected, actual, scope)
        : placeholderStringMatches(String(expected), actual, scope);

describe('placeholders', () => {
    test('a JSON context accepts any finite number, text context requires a decimal', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - a JSON number without decimals still matches float (JSON does not distinguish 42 from 42.0)
        expect(
            [42, 4.2, Number.NaN].map((value) => tokenMatches(match.float(), value, scope)),
        ).toStrictEqual([true, true, false]);

        // Then - a text value must carry the decimal part
        expect(
            [
                ['{{float}}', '42'],
                ['{{float}}', '4.2'],
                ['pi={{float}}', 'pi=3.14'],
                ['pi={{float}}', 'pi=3'],
            ].map(([expected, actual]) => tokenMatches(expected, actual, scope)),
        ).toStrictEqual([false, true, true, false]);
    });

    test('accepts ms, s, m, and h units', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - every documented unit matches, including hours
        expect(tokenMatches(match.duration(), '90m', scope)).toBe(true);
        expect(tokenMatches(match.duration(), '1.5s', scope)).toBe(true);
        expect(tokenMatches(match.duration(), '3h', scope)).toBe(true);
        expect(tokenMatches('took {{duration}}', 'took 3h', scope)).toBe(true);
        expect(tokenMatches(match.duration(), '2 weeks', scope)).toBe(false);
    });

    test('embedded {{port}} rejects out-of-range values', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - in-range ports match embedded, 99999 is rejected
        expect(tokenMatches('listening on :{{port}}', 'listening on :8080', scope)).toBe(true);
        expect(tokenMatches('listening on :{{port}}', 'listening on :65535', scope)).toBe(true);
        expect(tokenMatches('listening on :{{port}}', 'listening on :99999', scope)).toBe(false);

        // Then - whole-string and code-side forms agree
        expect(tokenMatches('{{port}}', '99999', scope)).toBe(false);
        expect(tokenMatches(match.port(), 99_999, scope)).toBe(false);
    });

    test('an unknown token is a literal; a literal "{{uuid}}" actual is unmatchable', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - {{nope}} is not in the vocabulary: compared as a literal string
        expect(tokenMatches('{{nope}}', '{{nope}}', scope)).toBe(true);
        expect(tokenMatches('{{nope}}', UUID_A, scope)).toBe(false);

        // Then - pinned: an actual value that IS the literal text "{{uuid}}" cannot be matched by a {{uuid}} fixture (the token always parses)
        expect(tokenMatches('{{uuid}}', '{{uuid}}', scope)).toBe(false);
    });

    test('{{any}} crosses lines, {{string}} stays on one line', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - embedded {{any}} spans a newline, {{string}} does not
        expect(tokenMatches('A {{any}} Z', 'A x\ny Z', scope)).toBe(true);
        expect(tokenMatches('A {{string}} Z', 'A x\ny Z', scope)).toBe(false);
        expect(tokenMatches('A {{string}} Z', 'A xy Z', scope)).toBe(true);
    });

    test('unnamed {{any}} tokens hold a golden longer than any pattern V8 compiles, each piece in order and none overlapping', () => {
        // Given - a fresh capture scope, and a golden of a hundred thousand lines around two tokens
        const scope = new CaptureScope();
        const lines = Array.from({ length: 100_000 }, (_, index) => `line ${String(index)} (a.b)`);
        const golden = `head\n{{any}}\n${lines.join('\n')}\n{{any}}tail`;

        // Then - the text holding the lines between the head and the tail matches, a line out of place does not
        expect(
            [
                `head\nversions\n${lines.join('\n')}\nmore tail`,
                `head\n\n${lines.join('\n')}\ntail`,
                `head\nversions\n${lines.toReversed().join('\n')}\ntail`,
                'head\n\ntail',
                'headtail',
            ].map((actual) => tokenMatches(golden, actual, scope)),
        ).toStrictEqual([true, true, false, false, false]);
        expect(
            [
                ['a{{any}}a', 'a'],
                ['a{{any}}a', 'aa'],
                ['a.b', 'axb'],
                ['a.b', 'a.b'],
                ['a{{any}}b', 'xxb'],
                ['a{{any}}bc{{any}}cd', 'abcd'],
                ['a{{any}}bc{{any}}cd', 'abccd'],
            ].map(([expected, actual]) => tokenMatches(expected, actual, scope)),
        ).toStrictEqual([false, true, false, true, false, false, true]);
    });

    test('{{any}} beside another token, or named, is matched by its pattern: it crosses lines, {{string}} does not, and a name holds one value', () => {
        // Given - a fresh capture scope for each comparison
        // Then - the pattern holds what each token holds
        expect(
            [
                ['A {{any}} {{int}}', 'A x\ny 3'],
                ['A {{any}} {{int}}', 'A x y'],
                ['A {{string}} {{int}}', 'A xy 3'],
                ['A {{string}} {{int}}', 'A x\ny 3'],
                ['a{{any#x}}-{{any#x}}', 'a1-1'],
                ['a{{any#x}}-{{any#x}}', 'a1-2'],
            ].map(([expected, actual]) => tokenMatches(expected, actual, new CaptureScope())),
        ).toStrictEqual([true, false, true, false, true, false]);
    });

    test('{{any}} is always-true only as a whole value; embedded, the frame still constrains', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - as a WHOLE value {{any}} accepts any type (objects, numbers, null), the documented carve-out behind the "always-true" claim
        expect(tokenMatches('{{any}}', { nested: true }, scope)).toBe(true);
        expect(tokenMatches('{{any}}', 42, scope)).toBe(true);
        expect(tokenMatches('{{any}}', null, scope)).toBe(true);

        // Then - embedded, {{any}} only widens the middle: a mismatched frame fails
        expect(tokenMatches('A {{any}} Z', 'A x\ny Q', scope)).toBe(false);
        // Then - embedded, a non-string/number actual cannot satisfy the frame
        expect(tokenMatches('A {{any}} Z', { nested: true }, scope)).toBe(false);
    });

    test('iso8601 accepts Z and numeric offsets, rejects offset-less timestamps', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - Z and numeric offsets pass, an offset-less timestamp fails
        expect(tokenMatches(match.iso8601(), '2026-07-17T10:00:00Z', scope)).toBe(true);
        expect(tokenMatches(match.iso8601(), '2026-07-17T10:00:00.123+02:00', scope)).toBe(true);
        expect(tokenMatches(match.iso8601(), '2026-07-17T10:00:00-05:00', scope)).toBe(true);
        expect(tokenMatches(match.iso8601(), '2026-07-17T10:00:00', scope)).toBe(false);
    });

    test('base64 and hex overlap on ambiguous values (pinned)', () => {
        // Given - a value that is valid in both alphabets
        const scope = new CaptureScope();

        // Then - pinned: "deadbeef" satisfies both tokens
        expect(tokenMatches(match.hex(), 'deadbeef', scope)).toBe(true);
        expect(tokenMatches(match.base64(), 'deadbeef', scope)).toBe(true);

        // Then - each token still rejects a value outside its alphabet (the overlap is not an "accepts anything" escape hatch)
        expect(tokenMatches(match.hex(), 'xyzt', scope)).toBe(false);
        expect(tokenMatches(match.base64(), 'not base64!', scope)).toBe(false);
    });

    test('recordRef — a second capture under one name equals the first across number and text, and objects whatever their key order', () => {
        // Given - pairs captured under one name each
        const pairs: [unknown, unknown][] = [
            [1, '1'],
            ['1', 1],
            [1, '2'],
            [true, 'true'],
            [
                { a: 1, b: [2, { c: 3, d: 4 }] },
                { b: [2, { d: 4, c: 3 }], a: 1 },
            ],
            [[1, 2], { 0: 1, 1: 2 }],
            [{ a: 1 }, { a: 2 }],
            [null, {}],
            [{}, null],
            [Number.NaN, Number.NaN],
            [[1], [2]],
            [1, [1]],
            ['1', [1]],
            [[1], 1],
            [Number.NaN, null],
            [null, Number.NaN],
        ];

        // Then - the second capture holds only where it is the same value
        expect(
            pairs.map(([first, second], at) => {
                const scope = new CaptureScope();
                recordRef(`r${at}`, first, scope);
                return recordRef(`r${at}`, second, scope);
            }),
        ).toStrictEqual([
            true,
            true,
            false,
            false,
            true,
            false,
            false,
            false,
            false,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
        ]);
    });

    test('kindMatches — a value of each kind, numbers in range, and a workdir only when the scope knows one', () => {
        // Given - a scope that knows its workdir, and one that does not
        const scope = new CaptureScope();
        scope.workdir = '/tmp/run';
        const blind = new CaptureScope();

        // Then - each value against its kind
        expect([
            [0, 65_535, 65_536, -1, 1.5, '65535', '65536', '0'].map((value) =>
                kindMatches('port', value, scope),
            ),
            [
                kindMatches('workdir', '/tmp/run', scope),
                kindMatches('workdir', '/tmp/run', blind),
                kindMatches('workdir', undefined, blind),
            ],
            [
                kindMatches('workdir', 1, scope),
                kindMatches('uuid', 7, scope),
                kindMatches('string', 'x', scope),
            ],
        ]).toStrictEqual([
            [true, true, false, false, false, true, false, true],
            [true, false, false],
            [false, false, true],
        ]);
    });

    test('matcherMatches — an includes, regex or ref matcher missing what it needs matches nothing, and a ref refuses its excluded capture', () => {
        // Given - a scope holding one capture
        const scope = new CaptureScope();
        scope.set('first', 'a');

        // Then - each matcher read
        expect([
            matcherMatches(new Matcher('includes'), 'is undefined', scope),
            matcherMatches(new Matcher('includes', { includes: 'b' }), 'abc', scope),
            matcherMatches(new Matcher('includes', { includes: 'b' }), 1, scope),
            matcherMatches(new Matcher('regex'), 'abc', scope),
            matcherMatches(new Matcher('regex', { regex: /^a/u }), 'abc', scope),
            matcherMatches(new Matcher('regex', { regex: /1/u }), 1, scope),
            matcherMatches(new Matcher('ref'), 'a', scope),
            matcherMatches(new Matcher('ref', { notRef: 'first', refName: 'second' }), 'a', scope),
            matcherMatches(new Matcher('ref', { notRef: 'first', refName: 'third' }), 'b', scope),
            matcherMatches(new Matcher('ref', { notRef: 'unset', refName: 'fourth' }), 'a', scope),
        ]).toStrictEqual([false, true, false, false, true, false, false, false, true, true]);
    });

    test('placeholderStringMatches — tokens inside text, each capture read from its own group, and a single token read as the whole value', () => {
        // Given - a scope, and texts holding tokens in each position
        const scope = new CaptureScope();
        const matches = (expected: string, actual: unknown): boolean =>
            placeholderStringMatches(expected, actual, scope);

        // Then - each text against its value
        expect([
            matches('{{int#a}} and {{int#b}}', '1 and 2'),
            matches('{{int#b}} then {{int#a}}', '2 then 1'),
            matches('{{int#a}} then {{int#b}}', '2 then 1'),
            matches('{{uuid}} and more', `${UUID_A} and more`),
            matches('x{{int}}', 'x7'),
            matches('{{int}}', 7),
            matches('n={{int}}', 7),
            matches('{{string}}e', true),
            matches('at {{workdir}}', 'at /tmp'),
            matches('at {{workdir}}', 'at '),
            matches('{{int}}{{int}}', 12),
        ]).toStrictEqual([true, true, false, true, true, true, false, false, false, false, true]);
    });
});
