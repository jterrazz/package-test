import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — j3-no-expectless-test (CONVENTIONS J3)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a test with no expect', async () => {
        // Given - a project violating J3
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j3-no-expectless-test/')
            .exec('.');

        // Then - oxlint reports the j3-no-expectless-test diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('j3-no-expectless-test');
    });

    test('accepts a test that asserts', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j3-no-expectless-test-ok/')
            .exec('.');

        // Then - clean run, no j3-no-expectless-test diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('j3-no-expectless-test');
    });
});
