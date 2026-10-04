import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-unknown-token', () => {
    test('rejects an unknown token in an _expected/ fixture', async () => {
        // Given - a specs tree whose text snapshot uses a token outside the frozen vocabulary
        const result = await checker.fixture(directory('./_fixtures/no-unknown-token/')).run();

        // Then - the checker fails with the full diagnostic (file, token, frozen vocabulary)
        expect(result.report).toMatch(`
            specs/widget/_expected/out.txt:1:1  jterrazz-check(no-unknown-token)
                found: the unknown token {{userid}}
                why: Every \`{{token}}\` in an \`_expected/\` fixture — or in an expected stream of a \`<case>.spec.yaml\` document — belongs to the frozen vocabulary; an unknown token is an error.
                fix: write one of the tokens the vocabulary has, between double braces: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir
                read: docs/reference/linting.md#no-unknown-token
        `);
    });

    test('rejects an unknown token in a document stream, never in its description', async () => {
        // Given - a <case>.spec.yaml whose description prose AND whose stdout golden both spell {{widget}} — only a stream carries the grammar
        const result = await checker.fixture(directory('./_fixtures/no-unknown-token-spec/')).run();

        // Then - one finding, on the stream line: a description is text, not tokens
        expect(result.report).toMatch(`
            specs/widget/builds.spec.yaml:6:1  jterrazz-check(no-unknown-token)
                found: the unknown token {{widget}}
                why: Every \`{{token}}\` in an \`_expected/\` fixture — or in an expected stream of a \`<case>.spec.yaml\` document — belongs to the frozen vocabulary; an unknown token is an error.
                fix: write one of the tokens the vocabulary has, between double braces: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir
                read: docs/reference/linting.md#no-unknown-token
        `);
    });

    test('accepts fixtures using only the frozen vocabulary', async () => {
        // Given - the compliant twin ({{uuid#id}}, {{iso8601}}, {{workdir}})
        const result = await checker.fixture(directory('./_fixtures/no-unknown-token-ok/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
