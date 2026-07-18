import { describe, expect, test } from 'vitest';

import { CaptureScope, match } from './match.js';
import {
    mergePreservingPlaceholders,
    mergeTextPreservingPlaceholders,
    structuralEquals,
    textEquals,
} from './structural.js';

const UUID_A = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';
const UUID_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('structural — float semantics (pinned)', () => {
    test('a JSON context accepts any finite number, text context requires a decimal', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - a JSON number without decimals still matches float (JSON does
        // Not distinguish 42 from 42.0)
        expect(structuralEquals(match.float(), 42, scope)).toBe(true);
        expect(structuralEquals(match.float(), 4.2, scope)).toBe(true);
        expect(structuralEquals(match.float(), Number.NaN, scope)).toBe(false);

        // Then - a text value must carry the decimal part
        expect(structuralEquals('{{float}}', '42', scope)).toBe(false);
        expect(structuralEquals('{{float}}', '4.2', scope)).toBe(true);
        expect(structuralEquals('pi={{float}}', 'pi=3.14', scope)).toBe(true);
        expect(structuralEquals('pi={{float}}', 'pi=3', scope)).toBe(false);
    });
});

describe('structural — duration token', () => {
    test('accepts ms, s, m, and h units', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - every documented unit matches, including hours
        expect(structuralEquals(match.duration(), '90m', scope)).toBe(true);
        expect(structuralEquals(match.duration(), '1.5s', scope)).toBe(true);
        expect(structuralEquals(match.duration(), '3h', scope)).toBe(true);
        expect(structuralEquals('took {{duration}}', 'took 3h', scope)).toBe(true);
        expect(structuralEquals(match.duration(), '2 weeks', scope)).toBe(false);
    });
});

describe('structural — port range (0-65535)', () => {
    test('embedded {{port}} rejects out-of-range values', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - in-range ports match embedded, 99999 is rejected
        expect(structuralEquals('listening on :{{port}}', 'listening on :8080', scope)).toBe(true);
        expect(structuralEquals('listening on :{{port}}', 'listening on :65535', scope)).toBe(true);
        expect(structuralEquals('listening on :{{port}}', 'listening on :99999', scope)).toBe(
            false,
        );

        // Then - whole-string and code-side forms agree
        expect(structuralEquals('{{port}}', '99999', scope)).toBe(false);
        expect(structuralEquals(match.port(), 99_999, scope)).toBe(false);
    });
});

describe('structural — capture equality', () => {
    test('object captures compare by content, not key order', () => {
        // Given - the same object captured twice with different key orders
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('obj'), { a: 2, b: 1 }, scope)).toBe(true);

        // Then - a re-ordered but structurally identical object is equal
        expect(structuralEquals(match.ref('obj'), { b: 1, a: 2 }, scope)).toBe(true);
        expect(structuralEquals(match.ref('obj'), { a: 2, b: 99 }, scope)).toBe(false);
    });

    test('cross-context ref equality: 42 captured from JSON equals "42" from text', () => {
        // Given - a number captured from a JSON context
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('n'), 42, scope)).toBe(true);

        // Then - the string form captured from a text context is equal
        expect(structuralEquals('{{int#n}}', '42', scope)).toBe(true);
        expect(structuralEquals('{{int#n}}', '43', scope)).toBe(false);
    });

    test('a ref is shared across textEquals and structuralEquals on one scope', () => {
        // Given - a uuid captured through a text snapshot comparison
        const scope = new CaptureScope();
        expect(textEquals(`session {{uuid#s}} opened`, `session ${UUID_A} opened`, scope)).toBe(
            true,
        );

        // Then - the same ref constrains a structural comparison on that scope
        expect(structuralEquals({ id: match.ref('s') }, { id: UUID_A }, scope)).toBe(true);
        expect(structuralEquals({ id: match.ref('s') }, { id: UUID_B }, scope)).toBe(false);
    });

    test('ref(b, { not: "a" }) works in both directions; a never-captured "a" passes (pinned)', () => {
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
});

describe('structural — token grammar edges (pinned)', () => {
    test('an unknown token is a literal; a literal "{{uuid}}" actual is unmatchable', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - {{nope}} is not in the vocabulary: compared as a literal string
        expect(structuralEquals('{{nope}}', '{{nope}}', scope)).toBe(true);
        expect(structuralEquals('{{nope}}', UUID_A, scope)).toBe(false);

        // Then - pinned: an actual value that IS the literal text "{{uuid}}"
        // Cannot be matched by a {{uuid}} fixture (the token always parses)
        expect(structuralEquals('{{uuid}}', '{{uuid}}', scope)).toBe(false);
    });

    test('{{any}} crosses lines, {{string}} stays on one line', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - embedded {{any}} spans a newline, {{string}} does not
        expect(textEquals('A {{any}} Z', 'A x\ny Z', scope)).toBe(true);
        expect(textEquals('A {{string}} Z', 'A x\ny Z', scope)).toBe(false);
        expect(textEquals('A {{string}} Z', 'A xy Z', scope)).toBe(true);
    });

    test('{{any}} is always-true only as a whole value; embedded, the frame still constrains', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - as a WHOLE value {{any}} accepts any type (objects, numbers, null),
        // The documented carve-out behind the "always-true" claim
        expect(structuralEquals('{{any}}', { nested: true }, scope)).toBe(true);
        expect(structuralEquals('{{any}}', 42, scope)).toBe(true);
        expect(structuralEquals('{{any}}', null, scope)).toBe(true);

        // Then - embedded, {{any}} only widens the middle: a mismatched frame fails
        expect(textEquals('A {{any}} Z', 'A x\ny Q', scope)).toBe(false);
        // Then - embedded, a non-string/number actual cannot satisfy the frame
        expect(structuralEquals('A {{any}} Z', { nested: true }, scope)).toBe(false);
    });

    test('iso8601 accepts Z and numeric offsets, rejects offset-less timestamps', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - Z and numeric offsets pass, an offset-less timestamp fails
        expect(structuralEquals(match.iso8601(), '2026-07-17T10:00:00Z', scope)).toBe(true);
        expect(structuralEquals(match.iso8601(), '2026-07-17T10:00:00.123+02:00', scope)).toBe(
            true,
        );
        expect(structuralEquals(match.iso8601(), '2026-07-17T10:00:00-05:00', scope)).toBe(true);
        expect(structuralEquals(match.iso8601(), '2026-07-17T10:00:00', scope)).toBe(false);
    });

    test('base64 and hex overlap on ambiguous values (pinned)', () => {
        // Given - a value that is valid in both alphabets
        const scope = new CaptureScope();

        // Then - pinned: "deadbeef" satisfies both tokens
        expect(structuralEquals(match.hex(), 'deadbeef', scope)).toBe(true);
        expect(structuralEquals(match.base64(), 'deadbeef', scope)).toBe(true);

        // Then - each token still rejects a value outside its alphabet (the
        // Overlap is not an "accepts anything" escape hatch)
        expect(structuralEquals(match.hex(), 'xyzt', scope)).toBe(false);
        expect(structuralEquals(match.base64(), 'not base64!', scope)).toBe(false);
    });
});

describe('structural — update-mode merges', () => {
    test('mergeTextPreservingPlaceholders follows the actual line count (pinned)', () => {
        // Given - a previous snapshot with placeholders and a different shape
        const scope = new CaptureScope();
        const previous = 'id {{uuid}}\nstale\nextra {{number}}';

        // Then - fewer actual lines: trailing previous lines are dropped
        expect(mergeTextPreservingPlaceholders(previous, `id ${UUID_A}\nfresh`, scope)).toBe(
            'id {{uuid}}\nfresh',
        );

        // Then - more actual lines: new lines are taken verbatim from actual
        expect(
            mergeTextPreservingPlaceholders(previous, `id ${UUID_A}\nfresh\ncount 3\ntail`, scope),
        ).toBe('id {{uuid}}\nfresh\ncount 3\ntail');
    });

    test('mergePreservingPlaceholders follows array growth and shrinkage', () => {
        // Given - a previous fixture array with a placeholder per slot
        const previous = ['{{uuid}}', '{{number}}'];

        // Then - growth: extra actual items are appended as concrete values
        expect(mergePreservingPlaceholders(previous, [UUID_A, 7, 'new'])).toEqual([
            '{{uuid}}',
            '{{number}}',
            'new',
        ]);

        // Then - shrinkage: the merged array matches the actual length
        expect(mergePreservingPlaceholders(previous, [UUID_A])).toEqual(['{{uuid}}']);
    });

    test('meta: a merged fixture passes the next comparison run', () => {
        // Given - fixtures freshly written by update mode
        const previousJson = { id: '{{uuid}}', name: 'STALE' };
        const actualJson = { id: UUID_B, name: 'Alice' };
        const mergedJson = mergePreservingPlaceholders(previousJson, actualJson);
        const mergedText = mergeTextPreservingPlaceholders(
            'id {{uuid}}\nstale',
            `id ${UUID_B}\nfresh`,
            new CaptureScope(),
        );

        // Then - the merged output matches the same actual on a normal run
        expect(structuralEquals(mergedJson, actualJson, new CaptureScope())).toBe(true);
        expect(textEquals(mergedText, `id ${UUID_B}\nfresh`, new CaptureScope())).toBe(true);
    });
});

describe('structural — update-mode workdir substitution (CONVENTIONS D5, JSON/text parity)', () => {
    const WORKDIR = '/tmp/spec-run-abcdef';

    test('mergePreservingPlaceholders substitutes the known cwd in JSON string leaves', () => {
        // Given - a fresh JSON fixture (no previous) whose values embed the cwd
        const actual = { cwd: WORKDIR, nested: { path: `${WORKDIR}/out.txt` }, other: 7 };

        // Then - the workdir is written back as its {{workdir}} token, not the
        // Run-specific temp path — parity with the text path
        expect(mergePreservingPlaceholders(null, actual, WORKDIR)).toEqual({
            cwd: '{{workdir}}',
            nested: { path: '{{workdir}}/out.txt' },
            other: 7,
        });
    });

    test('mergePreservingPlaceholders preserves a still-matching {{workdir}} placeholder', () => {
        // Given - a previous fixture that already tokenised the cwd
        const previous = { cwd: '{{workdir}}', id: '{{uuid}}', name: 'STALE' };
        const actual = { cwd: WORKDIR, id: UUID_A, name: 'Alice' };

        // Then - {{workdir}} and {{uuid}} survive, the stale literal refreshes
        expect(mergePreservingPlaceholders(previous, actual, WORKDIR)).toEqual({
            cwd: '{{workdir}}',
            id: '{{uuid}}',
            name: 'Alice',
        });
    });

    test('no workdir given: string leaves are left untouched (no-op parity)', () => {
        // Given - the same shape but no framework-known cwd (api/jobs mode)
        const actual = { cwd: WORKDIR };

        // Then - nothing is substituted
        expect(mergePreservingPlaceholders(null, actual)).toEqual({ cwd: WORKDIR });
    });

    test('meta: a workdir-substituted JSON fixture passes the next run (with {{workdir}} inside)', () => {
        // Given - a golden freshly written by update mode from cwd-bearing output
        const actual = { cwd: WORKDIR, log: `wrote ${WORKDIR}/out.txt`, name: 'Alice' };
        const merged = mergePreservingPlaceholders(null, actual, WORKDIR);

        // Then - the token is stored, and the merged golden matches the same
        // Actual on a normal (workdir-aware) comparison run
        expect(merged).toEqual({
            cwd: '{{workdir}}',
            log: 'wrote {{workdir}}/out.txt',
            name: 'Alice',
        });
        expect(structuralEquals(merged, actual, new CaptureScope(WORKDIR))).toBe(true);
    });

    test('parity: text and JSON paths emit the same {{workdir}} token from the same cwd', () => {
        // Given - the same cwd surfacing in a text stream and a JSON value
        const mergedText = mergeTextPreservingPlaceholders(
            null,
            `cwd ${WORKDIR}`,
            new CaptureScope(WORKDIR),
        );
        const mergedJson = mergePreservingPlaceholders(null, { cwd: WORKDIR }, WORKDIR);

        // Then - both channels tokenise it identically (no literal temp path leaks)
        expect(mergedText).toBe('cwd {{workdir}}');
        expect(mergedJson).toEqual({ cwd: '{{workdir}}' });
    });
});
