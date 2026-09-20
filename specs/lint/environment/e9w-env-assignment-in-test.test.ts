import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — e9w-env-assignment-in-test (CONVENTIONS E9)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a raw process.env assignment in a test', async () => {
        // Given - a project violating E9
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e9w-env-assignment-in-test/')
            .exec('.');

        // Then - oxlint warns (advisory — warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('e9w-env-assignment-in-test');
    });

    test('accepts the self-restoring stub', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e9w-env-assignment-in-test-ok/')
            .exec('.');

        // Then - clean exit, no E9 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('e9w-env-assignment-in-test');
    });
});
