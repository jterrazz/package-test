import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — w5w-scenario-settles (CONVENTIONS W5)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a scenario that ends on the action', async () => {
        // Given - a scenario whose last statement is a click
        const result = await cli
            .fixture('$FIXTURES/lint-violations/w5w-scenario-settles/')
            .exec('.');

        // Then - oxlint warns (advisory — warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('w5w-scenario-settles');
    });

    test('accepts a scenario that names what the action produced', async () => {
        // Given - the compliant twin, ending on see()
        const result = await cli
            .fixture('$FIXTURES/lint-violations/w5w-scenario-settles-ok/')
            .exec('.');

        // Then - clean run, no W5 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('w5w-scenario-settles');
    });
});
