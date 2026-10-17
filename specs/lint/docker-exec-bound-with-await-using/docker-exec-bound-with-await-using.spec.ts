import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('docker-exec-bound-with-await-using', () => {
    test('rejects a docker runner result bound without await using', async () => {
        // Given - a docker-aware spec and a test binding its result with const
        const result = await checker
            .fixture(directory('./__fixtures__/docker-exec-bound-with-await-using/'))
            .run();

        // Then - the checker fails with the full diagnostic naming the runner
        expect(result.report).toMatch(`
            specs/widget/widget.test.ts:8:1  jterrazz-check(docker-exec-bound-with-await-using)
                found: a result of the docker-aware runner "dockerCli" bound without \`await using\`
                why: Docker-aware runners are inferred from the \`docker:\` option of the imported specification file, and every \`.exec()\` result bound without \`await using\` is reported.
                fix: bind it with \`await using result = await dockerCli...\`, so the containers it started are removed at the end of the scope
                read: docs/reference/linting.md#docker-exec-bound-with-await-using
        `);
    });

    test('accepts a docker runner result bound with await using', async () => {
        // Given - the compliant twin (await using)
        const result = await checker
            .fixture(directory('./__fixtures__/docker-exec-bound-with-await-using-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
