import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('docker-exec-bound-with-await-using', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a docker runner result bound without await using', async () => {
        // Given - a docker-aware spec and a test binding its result with const
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/docker-exec-bound-with-await-using/'))
            .exec('.');

        // Then - the checker fails with the full diagnostic naming the runner
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/widget.test.ts:8:1: error jterrazz-check(docker-exec-bound-with-await-using): found: a result of the docker-aware runner "dockerCli" bound without \`await using\` · why: Docker-aware runners are inferred from the \`docker:\` option of the imported specification file, and every \`.exec()\` result bound without \`await using\` is reported. · fix: bind it with \`await using result = await dockerCli…\`, so the containers it started are removed at the end of the scope · read: docs/19-linting.md#docker-exec-bound-with-await-using

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('accepts a docker runner result bound with await using', async () => {
        // Given - the compliant twin (await using)
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/docker-exec-bound-with-await-using-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });
});
