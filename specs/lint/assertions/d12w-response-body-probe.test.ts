import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d12w-response-body-probe (CONVENTIONS D12)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a cluster of raw body probes in one test', async () => {
        // Given - a project whose test accumulates a body-probe cluster
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d12w-response-body-probe/')
            .exec('.');

        // Then - oxlint warns (advisory - warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d12w-response-body-probe');
    });

    test('stays silent on a single scalpel probe', async () => {
        // Given - the compliant twin, one probe below the threshold
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d12w-response-body-probe-ok/')
            .exec('.');

        // Then - clean run, no d12w-response-body-probe diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d12w-response-body-probe');
    });
});
