import { describe, expect, test } from 'vitest';

import { findKnownTokens, findMalformedRefs, findUnknownTokens } from './tokens.js';

describe('tokens', () => {
    test('findUnknownTokens (`no-unknown-token`) — flags an identifier-shaped token outside the vocabulary', () => {
        // Given - a fixture line with one unknown and one known token
        const violations = findUnknownTokens('user {{userid}} created at {{iso8601}}');

        // Then - only the unknown token is reported, with its line
        expect(violations).toStrictEqual([{ line: 1, token: '{{userid}}' }]);
    });

    test('findUnknownTokens (`no-unknown-token`) — accepts every known token, with and without capture refs', () => {
        // Given - a sample of the frozen vocabulary
        const text = '{{uuid}} {{uuid#id}} {{iso8601}} {{workdir}} {{any}} {{int#count}}';

        // Then - clean
        expect(findUnknownTokens(text)).toStrictEqual([]);
    });

    test('findMalformedRefs (`no-malformed-ref`) — flags a malformed ref on a known kind (empty ref, spaced)', () => {
        // Given - two malformed captures of otherwise-known kinds
        // Then - both are reported (they are not well-formed tokens)
        expect(findMalformedRefs('{{iso8601#}}')).toStrictEqual([
            { line: 1, token: '{{iso8601#}}' },
        ]);
        expect(findMalformedRefs('{{uuid #id}}')).toStrictEqual([
            { line: 1, token: '{{uuid #id}}' },
        ]);
    });

    test('findUnknownTokens (`no-unknown-token`) — reports the 1-based line of each finding', () => {
        // Given - an unknown token on the third line
        const violations = findUnknownTokens('ok\nok {{sha}}\nbad {{sha256}}');

        // Then - line 3
        expect(violations).toStrictEqual([{ line: 3, token: '{{sha256}}' }]);
    });

    test('findUnknownTokens (`no-unknown-token`) — ignores structural template noise like Go templates', () => {
        // Given - braces that are not identifier-shaped tokens
        const text = 'docker {{.Server.Version}} and {{ spaced }} and {{123}}';

        // Then - out of the grammar, not flagged
        expect(findUnknownTokens(text)).toStrictEqual([]);
    });

    test('findKnownTokens (`no-token-in-request`) — reports known tokens (the _requests/ leak signal)', () => {
        // Given - a request body carrying a token
        // Then - the known token is surfaced (an unknown one is not this signal)
        expect(findKnownTokens('{"id": "{{uuid}}", "x": "{{userid}}"}')).toStrictEqual([
            { line: 1, token: '{{uuid}}' },
        ]);
    });
});
