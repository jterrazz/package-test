import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — w1-scenario-pure (CONVENTIONS W1)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects an expect() inside a visit scenario', async () => {
        // Given - a scenario asserting mid-flight
        const result = await cli.fixture('$FIXTURES/lint-violations/w1-scenario-pure/').exec('.');

        // Then - oxlint reports the w1-scenario-pure diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('w1-scenario-pure');
    });

    test('accepts a pure scenario asserting on the result', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/w1-scenario-pure-ok/')
            .exec('.');

        // Then - clean run, no w1-scenario-pure diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('w1-scenario-pure');
    });
});
