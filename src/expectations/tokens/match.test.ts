import { describe, expect, test } from 'vitest';

import { CaptureScope } from './capture-scope.js';
import { match } from './match.js';
import { renderExpected, structuralEquals } from './structural.js';
import { mergePreservingPlaceholders } from './update-merge.js';

const UUID_A = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';
const UUID_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('match', () => {
    test.each([
        [match.uuid(), UUID_A, true],
        [match.uuid(), 'not-a-uuid', false],
        [match.iso8601(), '2026-07-17T10:00:00.000Z', true],
        [match.iso8601(), '2026-07-17', false],
        [match.number(), 42, true],
        [match.number(), '42', true],
        [match.number(), 'forty-two', false],
        [match.string(), 'text', true],
        [match.string(), 42, false],
        [match.any(), { deep: true }, true],
        [match.ulid(), '01ARZ3NDEKTSV4RRFFQ69G5FAV', true],
        [match.ulid(), 'not-a-ulid', false],
        [match.date(), '2026-07-17', true],
        [match.date(), '17/07/2026', false],
        [match.time(), '10:42:07', true],
        [match.time(), '10h42', false],
        [match.duration(), '12ms', true],
        [match.duration(), '1.5s', true],
        [match.duration(), '2 weeks', false],
        [match.semver(), '2.0.0-rc.1', true],
        [match.semver(), 'v2', false],
        [match.sha(), 'a1b2c3d', true],
        [match.sha(), 'xyz', false],
        [match.hex(), 'deadBEEF', true],
        [match.base64(), 'aGVsbG8=', true],
        [match.int(), 42, true],
        [match.int(), 4.2, false],
        [match.float(), 4.2, true],
        [match.float(), '4.2', true],
        [match.float(), 'abc', false],
        [match.port(), 8080, true],
        [match.port(), 99_999, false],
        [match.ip(), '127.0.0.1', true],
        [match.ip(), '255.255.255.255', true],
        [match.ip(), 'localhost', false],
        [match.ip(), '999.1.1.1', false],
        [match.ip(), '256.0.0.1', false],
        ['host {{ip}}', 'host 10.0.0.8', true],
        ['host {{ip}}', 'host 300.0.0.8', false],
        [match.url(), 'https://example.com/x?y=1', true],
        [match.url(), 'ftp://example.com', false],
        [match.email(), 'a@b.co', true],
        [match.email(), 'a-at-b', false],
        [match.path(), '/usr/local/bin', true],
        [match.path(), './rel/file.txt', true],
        [match.path(), 'no-slash', false],
        [match.regex(/^user-\d+$/u), 'user-42', true],
        [match.regex(/^user-\d+$/u), 'admin-42', false],
        ['{{number}}', 3600, true],
        ['{{uuid}}', UUID_A, true],
        ['{{uuid}}', 'nope', false],
        ['{{any}}', [1, 2, 3], true],
        ['/users/{{uuid}}/posts', `/users/${UUID_A}/posts`, true],
        ['/users/{{uuid}}/posts', '/users/abc/posts', false],
        ['took {{number}}ms', 'took 12ms', true],
    ] satisfies [unknown, unknown, boolean][])(
        'match — the token vocabulary — %s against %j is %s',
        (expected, actual, verdict) => {
            // Given - a fresh capture scope
            // Then - the matcher or the token accepts its form and refuses every other
            expect(structuralEquals(expected, actual, new CaptureScope())).toBe(verdict);
        },
    );

    test('match — typed matchers — includes matches a string containing the substring — code-only, never a token', () => {
        // Given - a fresh capture scope
        const scope = new CaptureScope();

        // Then - containment gates the value, and non-strings never pass
        expect(structuralEquals(match.includes('classify'), 'please classify this', scope)).toBe(
            true,
        );
        expect(structuralEquals(match.includes('classify'), 'please rank this', scope)).toBe(false);
        expect(structuralEquals(match.includes('42'), 42, scope)).toBe(false);

        expect(String(match.includes('classify'))).toBe('{{includes:classify}}');
    });

    test('match — typed matchers — each renders as the token it stands for in a failure diff', () => {
        // Given - a ref, a ref that must differ from another, a typed capture, and a regex
        // Then - each written as its token
        expect(
            [
                match.ref('user'),
                match.ref('user', { not: 'admin' }),
                match.uuid(),
                match.regex(/^a+$/u),
            ].map(String),
        ).toStrictEqual(['{{ref#user}}', '{{ref#user!admin}}', '{{uuid}}', '{{regex:^a+$}}']);
    });

    test('match — typed matchers — matchers compose inside structures', () => {
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

    test('match — full token vocabulary (rule `no-unknown-token`) — workdir matches the exact spec cwd known by the framework', () => {
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

    test('match — full token vocabulary (rule `no-unknown-token`) — every token is capturable via {{type#ref}}', () => {
        // Given - a semver captured under #v
        const scope = new CaptureScope();
        expect(structuralEquals('v{{semver#v}}', 'v1.2.3', scope)).toBe(true);

        // Then - the same ref must be equal on the next occurrence
        expect(structuralEquals('version {{semver#v}}', 'version 1.2.3', scope)).toBe(true);
        expect(structuralEquals('version {{semver#v}}', 'version 9.9.9', scope)).toBe(false);
    });

    test('match — refs (capture semantics) — first occurrence captures, later occurrences must equal it', () => {
        // Given - one scope shared by two comparisons
        const scope = new CaptureScope();

        // When - the first ref occurrence captures the value
        expect(structuralEquals(match.ref('id'), UUID_A, scope)).toBe(true);

        // Then - an equal value passes, a different one fails
        expect(structuralEquals(match.ref('id'), UUID_A, scope)).toBe(true);
        expect(structuralEquals(match.ref('id'), UUID_B, scope)).toBe(false);
    });

    test('match — refs (capture semantics) — { not } asserts inequality with another capture', () => {
        // Given - a captured value under "a"
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('a'), UUID_A, scope)).toBe(true);

        // Then - ref('b', { not: 'a' }) rejects equality with "a" and accepts anything else
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_A, scope)).toBe(false);
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_B, scope)).toBe(true);
    });

    test('match — refs (capture semantics) — scope isolates captures between spec executions', () => {
        // Given - two independent scopes (one per chain)
        const first = new CaptureScope();
        const second = new CaptureScope();

        // Then - a ref captured in one scope does not constrain the other
        expect(structuralEquals(match.ref('id'), UUID_A, first)).toBe(true);
        expect(structuralEquals(match.ref('id'), UUID_B, second)).toBe(true);
    });

    test('match — file-side placeholders — {{type#ref}} captures and enforces equality across occurrences', () => {
        // Given - one scope for the whole document
        const scope = new CaptureScope();
        const expected = { echo: '{{uuid#session}}', id: '{{uuid#session}}' };

        // Then - equal values pass, diverging values fail
        expect(structuralEquals(expected, { echo: UUID_A, id: UUID_A }, scope)).toBe(true);

        const freshScope = new CaptureScope();
        expect(structuralEquals(expected, { echo: UUID_A, id: UUID_B }, freshScope)).toBe(false);
    });

    test('match — rendering and update merge — renderExpected turns matchers into placeholder text', () => {
        // Given - a structure with matchers
        const rendered = renderExpected({ id: match.uuid(), name: match.ref('n') });

        // Then - matchers render as their placeholder form
        expect(rendered).toStrictEqual({ id: '{{uuid}}', name: '{{ref#n}}' });
    });

    test('match — rendering and update merge — mergePreservingPlaceholders keeps placeholder-covered segments', () => {
        // Given - a previous fixture with placeholders and stale literals
        const previous = { id: '{{uuid}}', name: 'STALE', when: '{{iso8601}}' };
        const actual = { id: UUID_B, name: 'Alice', when: '2026-07-17T10:00:00.000Z' };

        // When - update mode merges
        const merged = mergePreservingPlaceholders(previous, actual);

        // Then - placeholders preserved, stale literal replaced
        expect(merged).toStrictEqual({ id: '{{uuid}}', name: 'Alice', when: '{{iso8601}}' });
    });

    test('match — rendering and update merge — mergePreservingPlaceholders replaces placeholders that no longer match', () => {
        // Given - a placeholder whose type no longer matches the actual value
        const previous = { id: '{{uuid}}' };
        const actual = { id: 'no-longer-a-uuid' };

        // Then - the concrete value wins
        expect(mergePreservingPlaceholders(previous, actual)).toStrictEqual({
            id: 'no-longer-a-uuid',
        });
    });
});
