import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — w2w-user-facing-elements (CONVENTIONS W2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a testId() element inside a scenario', async () => {
        // Given - a scenario reaching for the escape hatch
        const result = await cli
            .fixture('$FIXTURES/lint-violations/w2w-user-facing-elements/')
            .exec('.');

        // Then - oxlint warns (advisory - warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('w2w-user-facing-elements');
    });

    test('stays silent on user-facing elements', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/w2w-user-facing-elements-ok/')
            .exec('.');

        // Then - clean run, no w2w-user-facing-elements diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('w2w-user-facing-elements');
    });
});
