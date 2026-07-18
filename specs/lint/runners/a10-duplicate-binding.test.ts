import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — a10-duplicate-binding (CONVENTIONS A10)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects two keys deriving the same compose service', async () => {
        // Given - a project violating A10
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a10-duplicate-binding/')
            .exec('.');

        // Then - oxlint reports the a10-duplicate-binding diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('a10-duplicate-binding');
    });

    test('accepts distinct service bindings', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a10-duplicate-binding-ok/')
            .exec('.');

        // Then - clean run, no a10-duplicate-binding diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('a10-duplicate-binding');
    });
});
