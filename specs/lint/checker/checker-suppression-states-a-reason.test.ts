import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('checker-suppression-states-a-reason', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a checker suppression with no reason', async () => {
        // Given - a tree violating \`checker-suppression-states-a-reason\`
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-suppression-states-a-reason/'))
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            api/orders/orders.spec.ts:9:1: error jterrazz-check(checker-suppression-states-a-reason): found: a checker suppression that does not say why · why: Every \`checker-disable-next-line\` / \`checker-disable-line\` directive carries \`-- <reason>\`, wherever a checker pass can be silenced: a test, a document, a fixture under ground. · fix: end the directive with its reason: \`checker-disable-next-line database-named-only-when-several -- <why this line is the exception>\` · read: docs/19-linting.md#checker-suppression-states-a-reason

            conventions checker: 1 error(s) found under {{workdir}}/specs
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test('accepts a suppression that says why', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(
                directory('./_fixtures/lint-violations/checker-suppression-states-a-reason-ok/'),
            )
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
    });
});
