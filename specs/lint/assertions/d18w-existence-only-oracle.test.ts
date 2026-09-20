import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d18w-existence-only-oracle (CONVENTIONS D18)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a test whose one assertion is an existence check', async () => {
        // Given - a project violating D18
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d18w-existence-only-oracle/')
            .exec('.');

        // Then - oxlint warns (advisory — warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d18w-existence-only-oracle');
    });

    test('accepts an assertion that says what came back', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d18w-existence-only-oracle-ok/')
            .exec('.');

        // Then - clean exit, no D18 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d18w-existence-only-oracle');
    });
});
