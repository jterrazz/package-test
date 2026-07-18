import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    checkConventionFiles,
    findKnownTokens,
    findUnknownTokens,
    formatViolations,
} from './checker.js';

// The fs-anchored cases run against the shared E2E fixture trees.
const FIXTURES = resolve(import.meta.dirname, '../../specs/fixtures/lint-violations');

describe('conventions checker — findUnknownTokens (D4)', () => {
    test('flags an identifier-shaped token outside the vocabulary', () => {
        // Given - a fixture line with one unknown and one known token
        const violations = findUnknownTokens('user {{userid}} created at {{iso8601}}');

        // Then - only the unknown token is reported, with its line
        expect(violations).toEqual([{ line: 1, token: '{{userid}}' }]);
    });

    test('accepts every known token, with and without capture refs', () => {
        // Given - a sample of the frozen vocabulary
        const text = '{{uuid}} {{uuid#id}} {{iso8601}} {{workdir}} {{any}} {{int#count}}';

        // Then - clean
        expect(findUnknownTokens(text)).toEqual([]);
    });

    test('flags a malformed ref on a known kind (empty ref, spaced)', () => {
        // Given - two malformed captures of otherwise-known kinds
        // Then - both are reported (they are not well-formed tokens)
        expect(findUnknownTokens('{{iso8601#}}')).toEqual([{ line: 1, token: '{{iso8601#}}' }]);
        expect(findUnknownTokens('{{uuid #id}}')).toEqual([{ line: 1, token: '{{uuid #id}}' }]);
    });

    test('reports the 1-based line of each finding', () => {
        // Given - an unknown token on the third line
        const violations = findUnknownTokens('ok\nok {{sha}}\nbad {{sha256}}');

        // Then - line 3
        expect(violations).toEqual([{ line: 3, token: '{{sha256}}' }]);
    });

    test('ignores structural template noise like Go templates', () => {
        // Given - braces that are not identifier-shaped tokens
        const text = 'docker {{.Server.Version}} and {{ spaced }} and {{123}}';

        // Then - out of the grammar, not flagged
        expect(findUnknownTokens(text)).toEqual([]);
    });
});

describe('conventions checker — findKnownTokens (D10)', () => {
    test('reports known tokens (the requests/ leak signal)', () => {
        // Given - a request body carrying a token
        // Then - the known token is surfaced (an unknown one is not this signal)
        expect(findKnownTokens('{"id": "{{uuid}}", "x": "{{userid}}"}')).toEqual([
            { line: 1, token: '{{uuid}}' },
        ]);
    });
});

describe('conventions checker — checkConventionFiles (D4)', () => {
    test('walks a specs tree and reports unknown tokens in fixture files', () => {
        // Given - the violation fixture tree ({{userid}} in expected/out.txt)
        const violations = checkConventionFiles(resolve(FIXTURES, 'd4-unknown-token'));

        // Then - the finding names the relative file, line, token and severity
        expect(violations).toEqual([
            expect.objectContaining({
                file: 'specs/widget/expected/out.txt',
                line: 1,
                severity: 'error',
                token: '{{userid}}',
            }),
        ]);

        // Then - the rendering carries file, token and the known vocabulary
        const rendered = formatViolations(violations);
        expect(rendered).toContain('specs/widget/expected/out.txt:1');
        expect(rendered).toContain('{{userid}}');
        expect(rendered).toContain('uuid');
    });

    test('passes the compliant twin', () => {
        // Given - the -ok tree (only known tokens)
        const violations = checkConventionFiles(resolve(FIXTURES, 'd4-unknown-token-ok'));

        // Then - clean
        expect(violations).toEqual([]);
    });
});
