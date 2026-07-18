import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d15w-status-only-probe (CONVENTIONS D15)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a test whose only assertion is a status probe', async () => {
        // Given - a project whose test asserts nothing but an HTTP status
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d15w-status-only-probe/')
            .exec('.');

        // Then - oxlint warns (advisory - warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d15w-status-only-probe');
    });

    test('stays silent on a status probe beside a golden', async () => {
        // Given - the compliant twin, a status probe alongside a full-response golden
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d15w-status-only-probe-ok/')
            .exec('.');

        // Then - clean run, no d15w-status-only-probe diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d15w-status-only-probe');
    });
});
