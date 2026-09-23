import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('lint — c16-document-outside-ground (CONVENTIONS C16)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('rejects a document filed under ground', async () => {
        // Given - a tree violating C16
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c16-document-outside-ground/'))
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            widget/expected/builds.spec.yaml:1:1: error jterrazz-check(c16): a \`.spec.yaml\` document is a SPEC, not ground — move it beside the test that runs it
            widget:1:1: error jterrazz-check(c9): domain directory has ground subdirs (expected) but no *.test.ts(x) or *.spec.yaml

            conventions checker: 2 error(s) found under {{workdir}}/specs
        `);
    });

    test('accepts a document beside the test that runs it', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/spec-document-ok/'))
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
    });
});
