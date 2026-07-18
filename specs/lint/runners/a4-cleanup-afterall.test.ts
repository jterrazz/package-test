import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — a4-cleanup-afterall (CONVENTIONS A4)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a specification file that never registers cleanup with afterAll', async () => {
        // Given - a project violating A4
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a4-cleanup-afterall/')
            .exec('.');

        // Then - oxlint reports the a4-cleanup-afterall diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('a4-cleanup-afterall');
    });

    test('accepts a specification file calling afterAll(cleanup)', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a4-cleanup-afterall-ok/')
            .exec('.');

        // Then - clean run, no a4-cleanup-afterall diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('a4-cleanup-afterall');
    });
});
