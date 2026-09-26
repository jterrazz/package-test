import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('no-malformed-ref', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a malformed capture ref on a known kind', async () => {
        // Given - an expected fixture with {{iso8601#}} (empty ref)
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-malformed-ref/'))
            .exec('.');

        // Then - the checker fails with the full diagnostic naming the offending token
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/_expected/out.txt:1:1: error jterrazz-check(no-malformed-ref): found: the malformed token {{iso8601#}} · why: A malformed ref of a known kind (\`{{iso8601#}}\`, \`{{uuid #id}}\`) in a text file under \`_expected/\` is an error. · fix: write iso8601 bare, or its named capture iso8601#<name>, between double braces · read: docs/19-linting.md#no-malformed-ref

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('accepts a well-formed capture ref', async () => {
        // Given - the compliant twin ({{iso8601#when}})
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-malformed-ref-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./_expected/clean.txt'));
    });
});
