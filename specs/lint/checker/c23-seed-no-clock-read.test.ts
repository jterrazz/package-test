import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('c23-seed-no-clock-read', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects every spelling of a clock read, and reads past a comment', async () => {
        // Given - a seed writing `datetime('now', …)`, `CURRENT_TIMESTAMP` and `NOW()`, under a comment that names one of them
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c23-seed-no-clock-read/'))
            .exec('specs');

        // Then - three findings, one per row, and none for the comment
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            widget/seeds/posts.sql:2:1: error jterrazz-check(c23): found: \`'now'\` reads the clock in a seed · why: A \`seeds/**/*.sql\` states absolute timestamps: \`CURRENT_TIMESTAMP\`/\`CURRENT_DATE\`/\`CURRENT_TIME\`, \`NOW()\` and the quoted \`'now'\` SQLite's date functions take (\`datetime('now')\`, \`strftime(…, 'now')\`, \`date('now', '-1 day')\`) are refused. · fix: replace \`'now'\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\` · read: docs/19-linting.md#c23-seed-no-clock-read
            widget/seeds/posts.sql:3:1: error jterrazz-check(c23): found: \`CURRENT_TIMESTAMP\` reads the clock in a seed · why: A \`seeds/**/*.sql\` states absolute timestamps: \`CURRENT_TIMESTAMP\`/\`CURRENT_DATE\`/\`CURRENT_TIME\`, \`NOW()\` and the quoted \`'now'\` SQLite's date functions take (\`datetime('now')\`, \`strftime(…, 'now')\`, \`date('now', '-1 day')\`) are refused. · fix: replace \`CURRENT_TIMESTAMP\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\` · read: docs/19-linting.md#c23-seed-no-clock-read
            widget/seeds/posts.sql:4:1: error jterrazz-check(c23): found: \`NOW()\` reads the clock in a seed · why: A \`seeds/**/*.sql\` states absolute timestamps: \`CURRENT_TIMESTAMP\`/\`CURRENT_DATE\`/\`CURRENT_TIME\`, \`NOW()\` and the quoted \`'now'\` SQLite's date functions take (\`datetime('now')\`, \`strftime(…, 'now')\`, \`date('now', '-1 day')\`) are refused. · fix: replace \`NOW()\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\` · read: docs/19-linting.md#c23-seed-no-clock-read

            conventions checker: 3 error(s) found under {{workdir}}/specs
        `);
    });

    test('accepts a seed that states the instants the case is about', async () => {
        // Given - the compliant twin, whose chain pins the run's clock instead
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c23-seed-no-clock-read-ok/'))
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
    });
});
