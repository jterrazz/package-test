import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('checker-suppression-names-a-pass', () => {
    test('rejects a checker suppression naming a retired id and one no pass has', async () => {
        // Given - a tree whose directive names a retired letter-code id and a lint rule
        const result = await checker
            .fixture(directory('./_fixtures/checker-suppression-names-a-pass/'))
            .run();

        // Then - each id no pass has is named at its directive
        expect(result.report).toMatch(`
            specs/api/orders/orders.spec.ts:9:1  jterrazz-check(checker-suppression-names-a-pass)
                found: a checker suppression naming \`c14-database-named-only-when-several\`, which no pass of the checker has
                why: Every id a \`checker-disable-next-line\` / \`checker-disable-line\` directive names is a pass of the checker, or \`*\`.
                fix: name the pass this line is the exception to, or delete the directive — \`c14-database-named-only-when-several\` silences nothing
                read: docs/19-linting.md#checker-suppression-names-a-pass
            specs/api/orders/orders.spec.ts:9:1  jterrazz-check(checker-suppression-names-a-pass)
                found: a checker suppression naming \`no-sleep\`, which no pass of the checker has
                why: Every id a \`checker-disable-next-line\` / \`checker-disable-line\` directive names is a pass of the checker, or \`*\`.
                fix: name the pass this line is the exception to, or delete the directive — \`no-sleep\` silences nothing
                read: docs/19-linting.md#checker-suppression-names-a-pass
        `);
    });

    test('accepts a suppression naming a pass of the checker', async () => {
        // Given - the compliant twin
        const result = await checker
            .fixture(directory('./_fixtures/checker-suppression-names-a-pass-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
