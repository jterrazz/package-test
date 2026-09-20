import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — j6w-given-in-the-test (CONVENTIONS J6)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a Given built in a hook', async () => {
        // Given - a project whose setup lives above its tests
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j6w-given-in-the-test/')
            .exec('.');

        // Then - oxlint warns (advisory — warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('j6w-given-in-the-test');
    });

    test('accepts a Given each test calls for itself', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j6w-given-in-the-test-ok/')
            .exec('.');

        // Then - clean run, no J6 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('j6w-given-in-the-test');
    });
});
