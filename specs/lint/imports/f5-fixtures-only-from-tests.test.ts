import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — f5-fixtures-only-from-tests (CONVENTIONS F5)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a fixtures module imported from a non-test file', async () => {
        // Given - a project violating F5
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f5-fixtures-only-from-tests/')
            .exec('.');

        // Then - oxlint reports the f5-fixtures-only-from-tests diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('f5-fixtures-only-from-tests');
    });

    test('accepts a fixtures module imported from its test', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f5-fixtures-only-from-tests-ok/')
            .exec('.');

        // Then - clean run, no f5-fixtures-only-from-tests diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('f5-fixtures-only-from-tests');
    });
});
