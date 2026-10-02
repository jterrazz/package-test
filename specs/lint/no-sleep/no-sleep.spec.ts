import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-sleep', () => {
    test('accepts framework-level synchronisation, and a double that settles late', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an arbitrary setTimeout sleep in a spec', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:8:36  jterrazz(no-sleep)
                found: an arbitrary sleep in a test
                why: No arbitrary sleep (\`setTimeout\`/\`setInterval\`/\`Atomics.wait\`, or a \`node:timers/promises\` import) in any test file — synchronisation is \`see()\`/\`gone()\` inside a scenario and \`waitUntil(predicate)\` everywhere else.
                fix: wait on what the sleep stands for: \`await waitUntil(() => <condition>)\`, or \`see()\`/\`gone()\` inside a scenario
                read: docs/19-linting.md#no-sleep
        `);
    });
});
