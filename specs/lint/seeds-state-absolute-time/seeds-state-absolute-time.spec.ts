import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('seeds-state-absolute-time', () => {
    test('rejects every spelling of a clock read, and reads past a comment', async () => {
        // Given - a seed writing `datetime('now', ...)`, `CURRENT_TIMESTAMP` and `NOW()`, under a comment that names one of them
        const result = await checker
            .fixture(directory('./__fixtures__/seeds-state-absolute-time/'))
            .run();

        // Then - three findings, one per row, and none for the comment
        expect(result.report).toMatch(`
            specs/widget/__seeds__/posts.sql:2:1  jterrazz-check(seeds-state-absolute-time)
                found: \`'now'\` reads the clock in a seed
                why: A \`__seeds__/**/*.sql\` states absolute timestamps: \`CURRENT_TIMESTAMP\`/\`CURRENT_DATE\`/\`CURRENT_TIME\`, \`NOW()\` and the quoted \`'now'\` SQLite's date functions take (\`datetime('now')\`, \`strftime(..., 'now')\`, \`date('now', '-1 day')\`) are refused.
                fix: replace \`'now'\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\`
                read: docs/reference/linting.md#seeds-state-absolute-time
            specs/widget/__seeds__/posts.sql:3:1  jterrazz-check(seeds-state-absolute-time)
                found: \`CURRENT_TIMESTAMP\` reads the clock in a seed
                why: A \`__seeds__/**/*.sql\` states absolute timestamps: \`CURRENT_TIMESTAMP\`/\`CURRENT_DATE\`/\`CURRENT_TIME\`, \`NOW()\` and the quoted \`'now'\` SQLite's date functions take (\`datetime('now')\`, \`strftime(..., 'now')\`, \`date('now', '-1 day')\`) are refused.
                fix: replace \`CURRENT_TIMESTAMP\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\`
                read: docs/reference/linting.md#seeds-state-absolute-time
            specs/widget/__seeds__/posts.sql:4:1  jterrazz-check(seeds-state-absolute-time)
                found: \`NOW()\` reads the clock in a seed
                why: A \`__seeds__/**/*.sql\` states absolute timestamps: \`CURRENT_TIMESTAMP\`/\`CURRENT_DATE\`/\`CURRENT_TIME\`, \`NOW()\` and the quoted \`'now'\` SQLite's date functions take (\`datetime('now')\`, \`strftime(..., 'now')\`, \`date('now', '-1 day')\`) are refused.
                fix: replace \`NOW()\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\`
                read: docs/reference/linting.md#seeds-state-absolute-time
        `);
    });

    test('accepts a seed that states the instants the case is about', async () => {
        // Given - the compliant twin, whose chain pins the run's clock instead
        const result = await checker
            .fixture(directory('./__fixtures__/seeds-state-absolute-time-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
