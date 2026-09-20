import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — w2-testid-states-what-is-missing (CONVENTIONS W2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('refuses a testId() that states nothing about the element', async () => {
        // Given - a scenario reaching for the escape hatch with no invariant written
        const result = await cli
            .fixture('$FIXTURES/lint-violations/w2-testid-states-what-is-missing/')
            .exec('.');

        // Then - it is an error now: the hatch costs one line
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('w2-testid-states-what-is-missing');
    });

    test('accepts the hatch when the line above says what the element lacks', async () => {
        // Given - the compliant twin, whose testId() carries its invariant
        const result = await cli
            .fixture('$FIXTURES/lint-violations/w2-testid-states-what-is-missing-ok/')
            .exec('.');

        // Then - clean run, no w2-testid-states-what-is-missing diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('w2-testid-states-what-is-missing');
    });
});
