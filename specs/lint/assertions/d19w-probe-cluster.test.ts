import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d19w-probe-cluster (CONVENTIONS D19)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects three probes on one stream with no golden', async () => {
        // Given - a project violating D19
        const result = await cli.fixture('$FIXTURES/lint-violations/d19w-probe-cluster/').exec('.');

        // Then - oxlint warns (advisory — warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d19w-probe-cluster');
    });

    test('accepts two targeted probes', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d19w-probe-cluster-ok/')
            .exec('.');

        // Then - clean exit, no D19 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d19w-probe-cluster');
    });
});
