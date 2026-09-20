import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d16w-ambient-value (CONVENTIONS D16)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects an instant sampled into the Given', async () => {
        // Given - a project violating D16
        const result = await cli.fixture('$FIXTURES/lint-violations/d16w-ambient-value/').exec('.');

        // Then - oxlint warns (advisory — warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d16w-ambient-value');
    });

    test('accepts a Given that pins every instant', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d16w-ambient-value-ok/')
            .exec('.');

        // Then - clean exit, no D16 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d16w-ambient-value');
    });
});
