import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d17w-double-only-oracle (CONVENTIONS D17)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a module test whose whole proof is a call log', async () => {
        // Given - a project violating D17
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d17w-double-only-oracle/')
            .exec('.');

        // Then - oxlint warns (advisory — warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d17w-double-only-oracle');
    });

    test('accepts a call log beside what the subject produced', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d17w-double-only-oracle-ok/')
            .exec('.');

        // Then - clean exit, no D17 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d17w-double-only-oracle');
    });
});
