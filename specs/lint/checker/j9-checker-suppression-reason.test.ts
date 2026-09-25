import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('j9-checker-suppression-reason', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a checker suppression with no reason', async () => {
        // Given - a tree violating J9
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/j9-checker-suppression-reason/'))
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            api/orders/orders.spec.ts:9:1: error jterrazz-check(j9): found: a checker suppression that does not say why · why: Every \`checker-disable-next-line\` / \`checker-disable-line\` directive carries \` -- <reason>\`, wherever a checker pass can be silenced: a test, a document, a fixture under ground. · fix: end the directive with its reason: \`checker-disable-next-line a7 -- <why this line is the exception>\` · read: docs/19-linting.md#j9-checker-suppression-reason

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
