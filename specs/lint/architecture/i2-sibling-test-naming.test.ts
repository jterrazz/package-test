import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — i2-sibling-test-naming (CONVENTIONS I2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a src/ module test with no neighbour module', async () => {
        // Given - a project violating I2
        const result = await cli
            .fixture('$FIXTURES/lint-violations/i2-sibling-test-naming/')
            .exec('.');

        // Then - oxlint reports the i2-sibling-test-naming diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('i2-sibling-test-naming');
    });

    test('accepts the sibling test naming', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/i2-sibling-test-naming-ok/')
            .exec('.');

        // Then - clean run, no i2-sibling-test-naming diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('i2-sibling-test-naming');
    });
});
