import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d13w-unfrozen-negative-fixture (CONVENTIONS D13)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a wrapped negative toMatch without frozen', async () => {
        // Given - a project whose negative toMatch omits { frozen: true }
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d13w-unfrozen-negative-fixture/')
            .exec('.');

        // Then - oxlint warns (advisory - warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d13w-unfrozen-negative-fixture');
    });

    test('stays silent when the negative fixture is frozen', async () => {
        // Given - the compliant twin, the same assertion with { frozen: true }
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d13w-unfrozen-negative-fixture-ok/')
            .exec('.');

        // Then - clean run, no d13w-unfrozen-negative-fixture diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d13w-unfrozen-negative-fixture');
    });
});
