import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('seeds-state-absolute-time', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects every spelling of a clock read, and reads past a comment', async () => {
        // Given - a seed writing `datetime('now', …)`, `CURRENT_TIMESTAMP` and `NOW()`, under a comment that names one of them
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/seeds-state-absolute-time/'))
            .exec('specs');

        // Then - three findings, one per row, and none for the comment
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            widget/_seeds/posts.sql:2:1: error jterrazz-check(seeds-state-absolute-time): found: \`'now'\` reads the clock in a seed · why: A \`_seeds/**/*.sql\` states absolute timestamps: \`CURRENT_TIMESTAMP\`/\`CURRENT_DATE\`/\`CURRENT_TIME\`, \`NOW()\` and the quoted \`'now'\` SQLite's date functions take (\`datetime('now')\`, \`strftime(…, 'now')\`, \`date('now', '-1 day')\`) are refused. · fix: replace \`'now'\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\` · read: docs/19-linting.md#seeds-state-absolute-time
            widget/_seeds/posts.sql:3:1: error jterrazz-check(seeds-state-absolute-time): found: \`CURRENT_TIMESTAMP\` reads the clock in a seed · why: A \`_seeds/**/*.sql\` states absolute timestamps: \`CURRENT_TIMESTAMP\`/\`CURRENT_DATE\`/\`CURRENT_TIME\`, \`NOW()\` and the quoted \`'now'\` SQLite's date functions take (\`datetime('now')\`, \`strftime(…, 'now')\`, \`date('now', '-1 day')\`) are refused. · fix: replace \`CURRENT_TIMESTAMP\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\` · read: docs/19-linting.md#seeds-state-absolute-time
            widget/_seeds/posts.sql:4:1: error jterrazz-check(seeds-state-absolute-time): found: \`NOW()\` reads the clock in a seed · why: A \`_seeds/**/*.sql\` states absolute timestamps: \`CURRENT_TIMESTAMP\`/\`CURRENT_DATE\`/\`CURRENT_TIME\`, \`NOW()\` and the quoted \`'now'\` SQLite's date functions take (\`datetime('now')\`, \`strftime(…, 'now')\`, \`date('now', '-1 day')\`) are refused. · fix: replace \`NOW()\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\` · read: docs/19-linting.md#seeds-state-absolute-time

            conventions checker: 3 error(s) found under {{workdir}}/specs
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test('accepts a seed that states the instants the case is about', async () => {
        // Given - the compliant twin, whose chain pins the run's clock instead
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/seeds-state-absolute-time-ok/'))
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
    });
});
