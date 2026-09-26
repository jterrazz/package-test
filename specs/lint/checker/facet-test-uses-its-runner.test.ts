import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('facet-test-uses-its-runner', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a spec that reaches no runner under its facet', async () => {
        // Given - a tree violating `facet-test-uses-its-runner`
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/facet-test-uses-its-runner/'))
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            api/orders/total.spec.ts:1:1: error jterrazz-check(facet-test-uses-its-runner): found: a test under the \`api\` facet that reaches no runner · why: A test under \`specs/<facet>/\`, where the facet root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself. · fix: import \`{ api }\` from \`api.specification.js\` and drive the product through it, or move the module test beside its module · read: docs/19-linting.md#facet-test-uses-its-runner

            conventions checker: 1 error(s) found under {{workdir}}/specs
        `);
    });

    test('leaves a golden under `expected/` alone, as it leaves `fixtures/`', async () => {
        // Given - the compliant twin, whose ground holds a `.test.ts` that IS a golden: the file a fixer is expected to write
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/facet-test-uses-its-runner-ok/'))
            .exec('specs');

        // Then - ground is ground whichever of the four names it carries: nothing under an underscored folder reaches a runner
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });

    test('accepts a spec that imports the runner of its facet', async () => {
        // Given - the compliant twin, whose second spec names the specification module with no extension
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/facet-test-uses-its-runner-ok/'))
            .exec('specs');

        // Then - the clean summary: the import SOURCE is what reaches the runner, however it spells the extension
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });
});
