import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('checker-suppression-names-a-pass', () => {
    test('rejects a checker suppression naming a retired id and one no pass has', async () => {
        // Given - a tree whose directive names a retired letter-code id and a lint rule
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-suppression-names-a-pass/'))
            .exec('specs');

        // Then - each id no pass has is named at its directive
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            api/orders/orders.spec.ts:9:1: error jterrazz-check(checker-suppression-names-a-pass): found: a checker suppression naming \`c14-database-named-only-when-several\`, which no pass of the checker has · why: Every id a \`checker-disable-next-line\` / \`checker-disable-line\` directive names is a pass of the checker, or \`*\`. · fix: name the pass this line is the exception to, or delete the directive — \`c14-database-named-only-when-several\` silences nothing · read: docs/19-linting.md#checker-suppression-names-a-pass
            api/orders/orders.spec.ts:9:1: error jterrazz-check(checker-suppression-names-a-pass): found: a checker suppression naming \`no-sleep\`, which no pass of the checker has · why: Every id a \`checker-disable-next-line\` / \`checker-disable-line\` directive names is a pass of the checker, or \`*\`. · fix: name the pass this line is the exception to, or delete the directive — \`no-sleep\` silences nothing · read: docs/19-linting.md#checker-suppression-names-a-pass

            conventions checker: 2 error(s) found under {{workdir}}/specs
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test('accepts a suppression naming a pass of the checker', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-suppression-names-a-pass-ok/'))
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
    });
});
