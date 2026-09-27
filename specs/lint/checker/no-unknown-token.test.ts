import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('no-unknown-token', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects an unknown token in an _expected/ fixture', async () => {
        // Given - a specs tree whose text snapshot uses a token outside the frozen vocabulary
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-unknown-token/'))
            .exec('.');

        // Then - the checker fails with the full diagnostic (file, token, frozen vocabulary)
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/_expected/out.txt:1:1: error jterrazz-check(no-unknown-token): found: the unknown token {{userid}} · why: Every \`{{token}}\` in an \`_expected/\` fixture — or in an expected stream of a \`<case>.spec.yaml\` document — belongs to the frozen vocabulary; an unknown token is an error. · fix: write one of the tokens the vocabulary has, between double braces: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir · read: docs/19-linting.md#no-unknown-token

            conventions checker: 1 error(s) found under {{workdir}}
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test('rejects an unknown token in a document stream, never in its description', async () => {
        // Given - a <case>.spec.yaml whose description prose AND whose stdout golden both spell {{widget}} — only a stream carries the grammar
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-unknown-token-spec/'))
            .exec('.');

        // Then - one finding, on the stream line: a description is text, not tokens
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:6:1: error jterrazz-check(no-unknown-token): found: the unknown token {{widget}} · why: Every \`{{token}}\` in an \`_expected/\` fixture — or in an expected stream of a \`<case>.spec.yaml\` document — belongs to the frozen vocabulary; an unknown token is an error. · fix: write one of the tokens the vocabulary has, between double braces: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir · read: docs/19-linting.md#no-unknown-token

            conventions checker: 1 error(s) found under {{workdir}}
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test('accepts fixtures using only the frozen vocabulary', async () => {
        // Given - the compliant twin ({{uuid#id}}, {{iso8601}}, {{workdir}})
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-unknown-token-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./_expected/clean.txt'));
    });
});
