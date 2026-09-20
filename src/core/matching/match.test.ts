import { describe, expect, test } from 'vitest';

import { CaptureScope, match } from './match.js';
import { mergePreservingPlaceholders, renderExpected, structuralEquals } from './structural.js';

const UUID_A = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';
const UUID_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('match — typed matchers', () => {
    test('uuid / iso8601 / number / string / any match by type', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - each matcher accepts its type and rejects others
        expect(structuralEquals(match.uuid(), UUID_A, scope)).toBeTruthy();
        expect(structuralEquals(match.uuid(), 'not-a-uuid', scope)).toBeFalsy();
        expect(structuralEquals(match.iso8601(), '2026-07-17T10:00:00.000Z', scope)).toBeTruthy();
        expect(structuralEquals(match.iso8601(), '2026-07-17', scope)).toBeFalsy();
        expect(structuralEquals(match.number(), 42, scope)).toBeTruthy();
        expect(structuralEquals(match.number(), '42', scope)).toBeTruthy();
        expect(structuralEquals(match.number(), 'forty-two', scope)).toBeFalsy();
        expect(structuralEquals(match.string(), 'text', scope)).toBeTruthy();
        expect(structuralEquals(match.string(), 42, scope)).toBeFalsy();
        expect(structuralEquals(match.any(), { deep: true }, scope)).toBeTruthy();
    });

    test('regex matches strings against the pattern', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - the regexp gates the value
        expect(structuralEquals(match.regex(/^user-\d+$/u), 'user-42', scope)).toBeTruthy();
        expect(structuralEquals(match.regex(/^user-\d+$/u), 'admin-42', scope)).toBeFalsy();
    });

    test('includes matches a string containing the substring — code-only, never a token', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - containment gates the value, and non-strings never pass
        expect(
            structuralEquals(match.includes('classify'), 'please classify this', scope),
        ).toBeTruthy();
        expect(structuralEquals(match.includes('classify'), 'please rank this', scope)).toBeFalsy();
        expect(structuralEquals(match.includes('42'), 42, scope)).toBeFalsy();

        // And - it renders as its own form, outside the `{{token}}` vocabulary
        expect(String(match.includes('classify'))).toBe('{{includes:classify}}');
    });

    test('matchers compose inside structures', () => {
        // Given - a structure mixing literals and matchers
        const scope = new CaptureScope();
        const expected = { id: match.uuid(), tags: ['a', match.string()], ttl: 3600 };

        // Then - deep comparison applies matchers per node
        expect(
            structuralEquals(expected, { id: UUID_A, tags: ['a', 'b'], ttl: 3600 }, scope),
        ).toBeTruthy();
        expect(
            structuralEquals(expected, { id: UUID_A, tags: ['a', 7], ttl: 3600 }, scope),
        ).toBeFalsy();
    });
});

describe('match — full token vocabulary (CONVENTIONS D4)', () => {
    test('identifier, time, and version tokens match their canonical forms', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - each token accepts its canonical form and rejects noise
        expect(structuralEquals(match.ulid(), '01ARZ3NDEKTSV4RRFFQ69G5FAV', scope)).toBeTruthy();
        expect(structuralEquals(match.ulid(), 'not-a-ulid', scope)).toBeFalsy();
        expect(structuralEquals(match.date(), '2026-07-17', scope)).toBeTruthy();
        expect(structuralEquals(match.date(), '17/07/2026', scope)).toBeFalsy();
        expect(structuralEquals(match.time(), '10:42:07', scope)).toBeTruthy();
        expect(structuralEquals(match.time(), '10h42', scope)).toBeFalsy();
        expect(structuralEquals(match.duration(), '12ms', scope)).toBeTruthy();
        expect(structuralEquals(match.duration(), '1.5s', scope)).toBeTruthy();
        expect(structuralEquals(match.duration(), '2 weeks', scope)).toBeFalsy();
        expect(structuralEquals(match.semver(), '2.0.0-rc.1', scope)).toBeTruthy();
        expect(structuralEquals(match.semver(), 'v2', scope)).toBeFalsy();
        expect(structuralEquals(match.sha(), 'a1b2c3d', scope)).toBeTruthy();
        expect(structuralEquals(match.sha(), 'xyz', scope)).toBeFalsy();
        expect(structuralEquals(match.hex(), 'deadBEEF', scope)).toBeTruthy();
        expect(structuralEquals(match.base64(), 'aGVsbG8=', scope)).toBeTruthy();
    });

    test('numeric and network tokens match their canonical forms', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - each numeric and network token matches its canonical form
        expect(structuralEquals(match.int(), 42, scope)).toBeTruthy();
        expect(structuralEquals(match.int(), 4.2, scope)).toBeFalsy();
        expect(structuralEquals(match.float(), 4.2, scope)).toBeTruthy();
        expect(structuralEquals(match.float(), '4.2', scope)).toBeTruthy();
        expect(structuralEquals(match.float(), 'abc', scope)).toBeFalsy();
        expect(structuralEquals(match.port(), 8080, scope)).toBeTruthy();
        expect(structuralEquals(match.port(), 99_999, scope)).toBeFalsy();
        expect(structuralEquals(match.ip(), '127.0.0.1', scope)).toBeTruthy();
        expect(structuralEquals(match.ip(), '255.255.255.255', scope)).toBeTruthy();
        expect(structuralEquals(match.ip(), 'localhost', scope)).toBeFalsy();
        // Each octet is bounded 0-255 (parity with {{port}}) — 999 is rejected
        expect(structuralEquals(match.ip(), '999.1.1.1', scope)).toBeFalsy();
        expect(structuralEquals(match.ip(), '256.0.0.1', scope)).toBeFalsy();
        // Embedded {{ip}} placeholder enforces the same range
        expect(structuralEquals('host {{ip}}', 'host 10.0.0.8', scope)).toBeTruthy();
        expect(structuralEquals('host {{ip}}', 'host 300.0.0.8', scope)).toBeFalsy();
        expect(structuralEquals(match.url(), 'https://example.com/x?y=1', scope)).toBeTruthy();
        expect(structuralEquals(match.url(), 'ftp://example.com', scope)).toBeFalsy();
        expect(structuralEquals(match.email(), 'a@b.co', scope)).toBeTruthy();
        expect(structuralEquals(match.email(), 'a-at-b', scope)).toBeFalsy();
        expect(structuralEquals(match.path(), '/usr/local/bin', scope)).toBeTruthy();
        expect(structuralEquals(match.path(), './rel/file.txt', scope)).toBeTruthy();
        expect(structuralEquals(match.path(), 'no-slash', scope)).toBeFalsy();
    });

    test('workdir matches the exact spec cwd known by the framework', () => {
        // Given - a scope carrying the spec cwd
        const scope = new CaptureScope('/tmp/spec-abc');

        // Then - exact equality, both as matcher and as embedded token
        expect(structuralEquals(match.workdir(), '/tmp/spec-abc', scope)).toBeTruthy();
        expect(structuralEquals(match.workdir(), '/tmp/other', scope)).toBeFalsy();
        expect(structuralEquals('cwd {{workdir}} ok', 'cwd /tmp/spec-abc ok', scope)).toBeTruthy();
        expect(structuralEquals('cwd {{workdir}} ok', 'cwd /tmp/other ok', scope)).toBeFalsy();

        // Then - without a known workdir the token never matches
        const blind = new CaptureScope();
        expect(structuralEquals(match.workdir(), '/tmp/spec-abc', blind)).toBeFalsy();
    });

    test('every token is capturable via {{type#ref}}', () => {
        // Given - a semver captured under #v
        const scope = new CaptureScope();
        expect(structuralEquals('v{{semver#v}}', 'v1.2.3', scope)).toBeTruthy();

        // Then - the same ref must be equal on the next occurrence
        expect(structuralEquals('version {{semver#v}}', 'version 1.2.3', scope)).toBeTruthy();
        expect(structuralEquals('version {{semver#v}}', 'version 9.9.9', scope)).toBeFalsy();
    });
});

describe('match — refs (capture semantics)', () => {
    test('first occurrence captures, later occurrences must equal it', () => {
        // Given - one scope shared by two comparisons
        const scope = new CaptureScope();

        // When - the first ref occurrence captures the value
        expect(structuralEquals(match.ref('id'), UUID_A, scope)).toBeTruthy();

        // Then - an equal value passes, a different one fails
        expect(structuralEquals(match.ref('id'), UUID_A, scope)).toBeTruthy();
        expect(structuralEquals(match.ref('id'), UUID_B, scope)).toBeFalsy();
    });

    test('{ not } asserts inequality with another capture', () => {
        // Given - a captured value under "a"
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('a'), UUID_A, scope)).toBeTruthy();

        // Then - ref('b', { not: 'a' }) rejects equality with "a" and accepts anything else
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_A, scope)).toBeFalsy();
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_B, scope)).toBeTruthy();
    });

    test('scope isolates captures between spec executions', () => {
        // Given - two independent scopes (one per chain)
        const first = new CaptureScope();
        const second = new CaptureScope();

        // Then - a ref captured in one scope does not constrain the other
        expect(structuralEquals(match.ref('id'), UUID_A, first)).toBeTruthy();
        expect(structuralEquals(match.ref('id'), UUID_B, second)).toBeTruthy();
    });
});

describe('match — file-side placeholders', () => {
    test('whole-string placeholders match typed values', () => {
        // Given - a fresh scope
        const scope = new CaptureScope();

        // Then - {{number}} matches a JSON number, {{uuid}} a uuid string
        expect(structuralEquals('{{number}}', 3600, scope)).toBeTruthy();
        expect(structuralEquals('{{uuid}}', UUID_A, scope)).toBeTruthy();
        expect(structuralEquals('{{uuid}}', 'nope', scope)).toBeFalsy();
        expect(structuralEquals('{{any}}', [1, 2, 3], scope)).toBeTruthy();
    });

    test('embedded placeholders match inside longer strings', () => {
        // Given - a fresh scope
        const scope = new CaptureScope();

        // Then - literal segments are exact, placeholder segments typed
        expect(
            structuralEquals('/users/{{uuid}}/posts', `/users/${UUID_A}/posts`, scope),
        ).toBeTruthy();
        expect(structuralEquals('/users/{{uuid}}/posts', '/users/abc/posts', scope)).toBeFalsy();
        expect(structuralEquals('took {{number}}ms', 'took 12ms', scope)).toBeTruthy();
    });

    test('{{type#ref}} captures and enforces equality across occurrences', () => {
        // Given - one scope for the whole document
        const scope = new CaptureScope();
        const expected = { echo: '{{uuid#session}}', id: '{{uuid#session}}' };

        // Then - equal values pass, diverging values fail
        expect(structuralEquals(expected, { echo: UUID_A, id: UUID_A }, scope)).toBeTruthy();

        const freshScope = new CaptureScope();
        expect(structuralEquals(expected, { echo: UUID_A, id: UUID_B }, freshScope)).toBeFalsy();
    });
});

describe('match — rendering and update merge', () => {
    test('renderExpected turns matchers into placeholder text', () => {
        // Given - a structure with matchers
        const rendered = renderExpected({ id: match.uuid(), name: match.ref('n') });

        // Then - matchers render as their placeholder form
        expect(rendered).toStrictEqual({ id: '{{uuid}}', name: '{{ref#n}}' });
    });

    test('mergePreservingPlaceholders keeps placeholder-covered segments', () => {
        // Given - a previous fixture with placeholders and stale literals
        const previous = { id: '{{uuid}}', name: 'STALE', when: '{{iso8601}}' };
        const actual = { id: UUID_B, name: 'Alice', when: '2026-07-17T10:00:00.000Z' };

        // When - update mode merges
        const merged = mergePreservingPlaceholders(previous, actual);

        // Then - placeholders preserved, stale literal replaced
        expect(merged).toStrictEqual({ id: '{{uuid}}', name: 'Alice', when: '{{iso8601}}' });
    });

    test('mergePreservingPlaceholders replaces placeholders that no longer match', () => {
        // Given - a placeholder whose type no longer matches the actual value
        const previous = { id: '{{uuid}}' };
        const actual = { id: 'no-longer-a-uuid' };

        // Then - the concrete value wins
        expect(mergePreservingPlaceholders(previous, actual)).toStrictEqual({
            id: 'no-longer-a-uuid',
        });
    });
});
