import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — a9w-redundant-root (CONVENTIONS A9)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns when root points at the directory the walk-up already finds', async () => {
        // Given - a project violating A9
        const result = await cli.fixture('$FIXTURES/lint-violations/a9w-redundant-root/').exec('.');

        // Then - oxlint reports the a9w-redundant-root diagnostic
        // Warnings do not fail the run - the diagnostic is advisory
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('a9w-redundant-root');
    });

    test('stays silent without a root override', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a9w-redundant-root-ok/')
            .exec('.');

        // Then - clean run, no a9w-redundant-root diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('a9w-redundant-root');
    });
});
