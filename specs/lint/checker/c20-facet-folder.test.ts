import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('c20-facet-folder', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a facet folder with no specification', async () => {
        // Given - a tree violating C20
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c20-facet-folder/'))
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            job:1:1: error jterrazz-check(c20): found: \`specs/job/\`, a facet folder with no specification constructing \`specification.job()\` · why: A first-level folder named for one of the six facets holds a \`*.specification.ts(x)\` calling \`specification.<facet>(\`. · fix: create \`specs/job/job.specification.ts\` calling \`specification.job()\`, or rename the folder · read: docs/19-linting.md#c20-facet-folder

            conventions checker: 1 error(s) found under {{workdir}}/specs
        `);
    });

    test('accepts a facet folder holding the runner it promises', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c20-facet-folder-ok/'))
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
    });
});
