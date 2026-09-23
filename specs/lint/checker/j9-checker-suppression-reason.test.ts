import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('lint — j9-checker-suppression-reason (CONVENTIONS J9)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('rejects a checker suppression with no reason', async () => {
        // Given - a tree violating J9
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/j9-checker-suppression-reason/'))
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            api/orders/orders.spec.ts:8:1: error jterrazz-check(j9): say why: \`checker-disable-next-line <id> -- <reason>\`

            conventions checker: 1 error(s) found under {{workdir}}/specs
        `);
    });

    test('accepts a suppression that says why', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/j9-checker-suppression-reason-ok/'))
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
    });
});
