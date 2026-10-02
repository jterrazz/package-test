import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('negative-golden-frozen', () => {
    test('rejects a wrapped negative toMatch without frozen', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/negative/negative.test.ts:10:18  jterrazz(negative-golden-frozen)
                found: a golden matcher whose mismatch is the subject, with no \`{ frozen: true }\`
                why: A golden \`toMatch(file(…))\`/\`toMatch(directory(…))\`, or a \`toMatch(<value>)\` on a result (the value written in place, rewritten in the test), whose FAILURE is the subject of the test must carry \`{ frozen: true }\` → otherwise \`TEST_UPDATE=1\` silently rewrites the deliberately-wrong expectation instead of throwing → error.
                fix: pass \`{ frozen: true }\` as its last argument, so \`TEST_UPDATE=1\` never rewrites the deliberately wrong expectation
                read: docs/19-linting.md#negative-golden-frozen
        `);
    });

    test('stays silent when the negative fixture is frozen', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
