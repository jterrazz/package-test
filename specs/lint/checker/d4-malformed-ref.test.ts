import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('lint — d4 malformed ref (CONVENTIONS D4)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (third-party linters) does not apply.
    test('rejects a malformed capture ref on a known kind', async () => {
        // Given - an expected fixture with {{iso8601#}} (empty ref)
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/d4-malformed-ref/'))
            .exec('.');

        // Then - the checker fails with the full diagnostic naming the offending token
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/expected/out.txt:1:1: error jterrazz-check(d4): unknown token {{string}} — the D4 vocabulary is frozen (known: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir)

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('accepts a well-formed capture ref', async () => {
        // Given - the compliant twin ({{iso8601#when}})
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/d4-malformed-ref-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });
});
