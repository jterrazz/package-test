import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d16-sampled-oracle (CONVENTIONS D16)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects an oracle that samples the clock', async () => {
        // Given - a project violating D16
        const result = await cli.fixture('$FIXTURES/lint-violations/d16-sampled-oracle/').exec('.');

        // Then - the diagnostic names the rule
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('scenario.test.ts')).toContain('d16-sampled-oracle');
    });

    test('accepts an oracle the test states', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d16-sampled-oracle-ok/')
            .exec('.');

        // Then - clean exit, no D16 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d16-sampled-oracle');
    });
});
