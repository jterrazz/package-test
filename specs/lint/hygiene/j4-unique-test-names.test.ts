import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — j4-unique-test-names (CONVENTIONS J4)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects two tests sharing a name', async () => {
        // Given - a project violating J4
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j4-unique-test-names/')
            .exec('.');

        // Then - oxlint reports the j4-unique-test-names diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('j4-unique-test-names');
    });

    test('accepts distinct test names', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j4-unique-test-names-ok/')
            .exec('.');

        // Then - clean run, no j4-unique-test-names diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('j4-unique-test-names');
    });
});
