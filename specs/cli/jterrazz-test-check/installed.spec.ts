import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('installed', () => {
    test('the bin npm links from the install judges a consumer’s specs tree, each finding naming the page that explains it', async () => {
        // Given - a consumer's project whose specs tree breaks two conventions
        const result = await cli
            .fixture(directory('../../_shared/_fixtures/file-suffix-matches-place-placement/'))
            .exec('jterrazz-test-check .');

        // Then - the run fails on each finding, as the checker the consumer installed prints it
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            specs/api/users/creation.test.ts:1:1: error jterrazz-check(file-suffix-matches-place): found: a \`.test.ts\` under \`specs/api/\`, where a file specifies the assembled product · why: The suffix says the kind, and the tree agrees with it. · fix: rename it \`api/users/creation.spec.ts\` — \`make fix\` does it with \`git mv\` · read: docs/24-linting.md#file-suffix-matches-place
            specs/api/helpers/normalize.test.ts:1:1: error jterrazz-check(facet-test-uses-its-runner): found: a test under the \`api\` facet that reaches no runner · why: A test under \`specs/<facet>/\`, where the facet root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself. · fix: import \`{ api }\` from \`api.specification.js\` and drive the product through it, or move the module test beside its module · read: docs/24-linting.md#facet-test-uses-its-runner
            found: every finding above, and jterrazz.baseline.json records no \`jterrazz-check/\` entry in its \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/24-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test('the bin npm links from the install passes a consumer’s tree that keeps the conventions', async () => {
        // Given - a consumer's project whose specs tree is in order
        const result = await cli
            .fixture(directory('../../_shared/_fixtures/spec-document-ok/'))
            .exec('jterrazz-test-check .');

        // Then - the run passes, and says what the ratchet holds
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
    });
});
