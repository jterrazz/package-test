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
        expect(structuralEquals(match.uuid(), UUID_A, scope)).toBe(true);
        expect(structuralEquals(match.uuid(), 'not-a-uuid', scope)).toBe(false);
        expect(structuralEquals(match.iso8601(), '2026-07-17T10:00:00.000Z', scope)).toBe(true);
        expect(structuralEquals(match.iso8601(), '2026-07-17', scope)).toBe(false);
        expect(structuralEquals(match.number(), 42, scope)).toBe(true);
        expect(structuralEquals(match.number(), '42', scope)).toBe(true);
        expect(structuralEquals(match.number(), 'forty-two', scope)).toBe(false);
        expect(structuralEquals(match.string(), 'text', scope)).toBe(true);
        expect(structuralEquals(match.string(), 42, scope)).toBe(false);
        expect(structuralEquals(match.any(), { deep: true }, scope)).toBe(true);
    });

    test('regex matches strings against the pattern', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - the regexp gates the value
        expect(structuralEquals(match.regex(/^user-\d+$/), 'user-42', scope)).toBe(true);
        expect(structuralEquals(match.regex(/^user-\d+$/), 'admin-42', scope)).toBe(false);
    });

    test('matchers compose inside structures', () => {
        // Given - a structure mixing literals and matchers
        const scope = new CaptureScope();
        const expected = { id: match.uuid(), tags: ['a', match.string()], ttl: 3600 };

        // Then - deep comparison applies matchers per node
        expect(structuralEquals(expected, { id: UUID_A, tags: ['a', 'b'], ttl: 3600 }, scope)).toBe(
            true,
        );
        expect(structuralEquals(expected, { id: UUID_A, tags: ['a', 7], ttl: 3600 }, scope)).toBe(
            false,
        );
    });
});

describe('match — full token vocabulary (CONVENTIONS D4)', () => {
    test('identifier, time, and version tokens match their canonical forms', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - each token accepts its canonical form and rejects noise
        expect(structuralEquals(match.ulid(), '01ARZ3NDEKTSV4RRFFQ69G5FAV', scope)).toBe(true);
        expect(structuralEquals(match.ulid(), 'not-a-ulid', scope)).toBe(false);
        expect(structuralEquals(match.date(), '2026-07-17', scope)).toBe(true);
        expect(structuralEquals(match.date(), '17/07/2026', scope)).toBe(false);
        expect(structuralEquals(match.time(), '10:42:07', scope)).toBe(true);
        expect(structuralEquals(match.time(), '10h42', scope)).toBe(false);
        expect(structuralEquals(match.duration(), '12ms', scope)).toBe(true);
        expect(structuralEquals(match.duration(), '1.5s', scope)).toBe(true);
        expect(structuralEquals(match.duration(), '2 weeks', scope)).toBe(false);
        expect(structuralEquals(match.semver(), '2.0.0-rc.1', scope)).toBe(true);
        expect(structuralEquals(match.semver(), 'v2', scope)).toBe(false);
        expect(structuralEquals(match.sha(), 'a1b2c3d', scope)).toBe(true);
        expect(structuralEquals(match.sha(), 'xyz', scope)).toBe(false);
        expect(structuralEquals(match.hex(), 'deadBEEF', scope)).toBe(true);
        expect(structuralEquals(match.base64(), 'aGVsbG8=', scope)).toBe(true);
    });

    test('numeric and network tokens match their canonical forms', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - each numeric and network token matches its canonical form
        expect(structuralEquals(match.int(), 42, scope)).toBe(true);
        expect(structuralEquals(match.int(), 4.2, scope)).toBe(false);
        expect(structuralEquals(match.float(), 4.2, scope)).toBe(true);
        expect(structuralEquals(match.float(), '4.2', scope)).toBe(true);
        expect(structuralEquals(match.float(), 'abc', scope)).toBe(false);
        expect(structuralEquals(match.port(), 8080, scope)).toBe(true);
        expect(structuralEquals(match.port(), 99_999, scope)).toBe(false);
        expect(structuralEquals(match.ip(), '127.0.0.1', scope)).toBe(true);
        expect(structuralEquals(match.ip(), '255.255.255.255', scope)).toBe(true);
        expect(structuralEquals(match.ip(), 'localhost', scope)).toBe(false);
        // Each octet is bounded 0-255 (parity with {{port}}) — 999 is rejected
        expect(structuralEquals(match.ip(), '999.1.1.1', scope)).toBe(false);
        expect(structuralEquals(match.ip(), '256.0.0.1', scope)).toBe(false);
        // Embedded {{ip}} placeholder enforces the same range
        expect(structuralEquals('host {{ip}}', 'host 10.0.0.8', scope)).toBe(true);
        expect(structuralEquals('host {{ip}}', 'host 300.0.0.8', scope)).toBe(false);
        expect(structuralEquals(match.url(), 'https://example.com/x?y=1', scope)).toBe(true);
        expect(structuralEquals(match.url(), 'ftp://example.com', scope)).toBe(false);
        expect(structuralEquals(match.email(), 'a@b.co', scope)).toBe(true);
        expect(structuralEquals(match.email(), 'a-at-b', scope)).toBe(false);
        expect(structuralEquals(match.path(), '/usr/local/bin', scope)).toBe(true);
        expect(structuralEquals(match.path(), './rel/file.txt', scope)).toBe(true);
        expect(structuralEquals(match.path(), 'no-slash', scope)).toBe(false);
    });

    test('workdir matches the exact spec cwd known by the framework', () => {
        // Given - a scope carrying the spec cwd
        const scope = new CaptureScope('/tmp/spec-abc');

        // Then - exact equality, both as matcher and as embedded token
        expect(structuralEquals(match.workdir(), '/tmp/spec-abc', scope)).toBe(true);
        expect(structuralEquals(match.workdir(), '/tmp/other', scope)).toBe(false);
        expect(structuralEquals('cwd {{workdir}} ok', 'cwd /tmp/spec-abc ok', scope)).toBe(true);
        expect(structuralEquals('cwd {{workdir}} ok', 'cwd /tmp/other ok', scope)).toBe(false);

        // Then - without a known workdir the token never matches
        const blind = new CaptureScope();
        expect(structuralEquals(match.workdir(), '/tmp/spec-abc', blind)).toBe(false);
    });

    test('every token is capturable via {{type#ref}}', () => {
        // Given - a semver captured under #v
        const scope = new CaptureScope();
        expect(structuralEquals('v{{semver#v}}', 'v1.2.3', scope)).toBe(true);

        // Then - the same ref must be equal on the next occurrence
        expect(structuralEquals('version {{semver#v}}', 'version 1.2.3', scope)).toBe(true);
        expect(structuralEquals('version {{semver#v}}', 'version 9.9.9', scope)).toBe(false);
    });
});

describe('match — refs (capture semantics)', () => {
    test('first occurrence captures, later occurrences must equal it', () => {
        // Given - one scope shared by two comparisons
        const scope = new CaptureScope();

        // When - the first ref occurrence captures the value
        expect(structuralEquals(match.ref('id'), UUID_A, scope)).toBe(true);

        // Then - an equal value passes, a different one fails
        expect(structuralEquals(match.ref('id'), UUID_A, scope)).toBe(true);
        expect(structuralEquals(match.ref('id'), UUID_B, scope)).toBe(false);
    });

    test('{ not } asserts inequality with another capture', () => {
        // Given - a captured value under "a"
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('a'), UUID_A, scope)).toBe(true);

        // Then - ref('b', { not: 'a' }) rejects equality with "a" and accepts anything else
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_A, scope)).toBe(false);
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_B, scope)).toBe(true);
    });

    test('scope isolates captures between spec executions', () => {
        // Given - two independent scopes (one per chain)
        const first = new CaptureScope();
        const second = new CaptureScope();

        // Then - a ref captured in one scope does not constrain the other
        expect(structuralEquals(match.ref('id'), UUID_A, first)).toBe(true);
        expect(structuralEquals(match.ref('id'), UUID_B, second)).toBe(true);
    });
});

describe('match — file-side placeholders', () => {
    test('whole-string placeholders match typed values', () => {
        // Given - a fresh scope
        const scope = new CaptureScope();

        // Then - {{number}} matches a JSON number, {{uuid}} a uuid string
        expect(structuralEquals('{{number}}', 3600, scope)).toBe(true);
        expect(structuralEquals('{{uuid}}', UUID_A, scope)).toBe(true);
        expect(structuralEquals('{{uuid}}', 'nope', scope)).toBe(false);
        expect(structuralEquals('{{any}}', [1, 2, 3], scope)).toBe(true);
    });

    test('embedded placeholders match inside longer strings', () => {
        // Given - a fresh scope
        const scope = new CaptureScope();

        // Then - literal segments are exact, placeholder segments typed
        expect(structuralEquals('/users/{{uuid}}/posts', `/users/${UUID_A}/posts`, scope)).toBe(
            true,
        );
        expect(structuralEquals('/users/{{uuid}}/posts', '/users/abc/posts', scope)).toBe(false);
        expect(structuralEquals('took {{number}}ms', 'took 12ms', scope)).toBe(true);
    });

    test('{{type#ref}} captures and enforces equality across occurrences', () => {
        // Given - one scope for the whole document
        const scope = new CaptureScope();
        const expected = { echo: '{{uuid#session}}', id: '{{uuid#session}}' };

        // Then - equal values pass, diverging values fail
        expect(structuralEquals(expected, { echo: UUID_A, id: UUID_A }, scope)).toBe(true);

        const freshScope = new CaptureScope();
        expect(structuralEquals(expected, { echo: UUID_A, id: UUID_B }, freshScope)).toBe(false);
    });
});

describe('match — rendering and update merge', () => {
    test('renderExpected turns matchers into placeholder text', () => {
        // Given - a structure with matchers
        const rendered = renderExpected({ id: match.uuid(), name: match.ref('n') });

        // Then - matchers render as their placeholder form
        expect(rendered).toEqual({ id: '{{uuid}}', name: '{{ref#n}}' });
    });

    test('mergePreservingPlaceholders keeps placeholder-covered segments', () => {
        // Given - a previous fixture with placeholders and stale literals
        const previous = { id: '{{uuid}}', name: 'STALE', when: '{{iso8601}}' };
        const actual = { id: UUID_B, name: 'Alice', when: '2026-07-17T10:00:00.000Z' };

        // When - update mode merges
        const merged = mergePreservingPlaceholders(previous, actual);

        // Then - placeholders preserved, stale literal replaced
        expect(merged).toEqual({ id: '{{uuid}}', name: 'Alice', when: '{{iso8601}}' });
    });

    test('mergePreservingPlaceholders replaces placeholders that no longer match', () => {
        // Given - a placeholder whose type no longer matches the actual value
        const previous = { id: '{{uuid}}' };
        const actual = { id: 'no-longer-a-uuid' };

        // Then - the concrete value wins
        expect(mergePreservingPlaceholders(previous, actual)).toEqual({
            id: 'no-longer-a-uuid',
        });
    });
});
