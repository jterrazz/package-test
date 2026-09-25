import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('b5-await-using-inference', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (third-party linters) does not apply.
    test('rejects a docker runner result bound without await using', async () => {
        // Given - a docker-aware spec and a test binding its result with const
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/b5-await-using-inference/'))
            .exec('.');

        // Then - the checker fails with the full diagnostic naming the runner
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/widget.test.ts:8:1: error jterrazz-check(b5): found: a result of the docker-aware runner "dockerCli" bound without \`await using\` · why: B5's one channel: docker-aware runners are inferred from the \`docker:\` option of the imported specification file, and every \`.exec()\` result bound without \`await using\` is reported. · fix: bind it with \`await using result = await dockerCli…\`, so the containers it started are removed at the end of the scope · read: docs/19-linting.md#b5-await-using-inference

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('accepts a docker runner result bound with await using', async () => {
        // Given - the compliant twin (await using)
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/b5-await-using-inference-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });
});
