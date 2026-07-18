import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — c4-contract-shape (CONVENTIONS C4)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a contract file with an unknown provider suffix', async () => {
        // Given - a project violating C4
        const result = await cli.fixture('$FIXTURES/lint-violations/c4-contract-shape/').exec('.');

        // Then - oxlint reports the c4-contract-shape diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('c4-contract-shape');
    });

    test('accepts a well-formed contract file', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c4-contract-shape-ok/')
            .exec('.');

        // Then - clean run, no c4-contract-shape diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('c4-contract-shape');
    });
});
