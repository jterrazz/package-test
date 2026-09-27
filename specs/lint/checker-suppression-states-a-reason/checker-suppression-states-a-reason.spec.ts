import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('checker-suppression-states-a-reason', () => {
    test('rejects a checker suppression with no reason', async () => {
        // Given - a tree violating \`checker-suppression-states-a-reason\`
        const result = await checker
            .fixture(directory('./_fixtures/checker-suppression-states-a-reason/'))
            .run();

        // Then - the pass names the file and what to do about it
        expect(result.report).toMatch(`
            specs/api/orders/orders.spec.ts:9:1  jterrazz-check(checker-suppression-states-a-reason)
                found: a checker suppression that does not say why
                why: Every \`checker-disable-next-line\` / \`checker-disable-line\` directive carries \`-- <reason>\`, wherever a checker pass can be silenced: a test, a document, a fixture under ground.
                fix: end the directive with its reason: \`checker-disable-next-line database-named-only-when-several -- <why this line is the exception>\`
                read: docs/19-linting.md#checker-suppression-states-a-reason
        `);
    });

    test('accepts a suppression that says why', async () => {
        // Given - the compliant twin
        const result = await checker
            .fixture(directory('./_fixtures/checker-suppression-states-a-reason-ok/'))
            .run();

        // Then - the clean summary
        expect(result.report).toMatch('');
    });
});
