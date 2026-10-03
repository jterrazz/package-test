import { describe, expect, test } from 'vitest';

import { CaptureScope } from './capture-scope.js';
import { match, Matcher } from './match.js';
import { matcherMatches, placeholderStringMatches } from './placeholders.js';

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
});
