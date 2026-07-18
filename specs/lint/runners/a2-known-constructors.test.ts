import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — a2-known-constructors (CONVENTIONS A2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects specification.app - only api, jobs and cli exist', async () => {
        // Given - a project violating A2
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a2-known-constructors/')
            .exec('.');

        // Then - oxlint reports the a2-known-constructors diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('a2-known-constructors');
    });

    test('accepts the three known constructors', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a2-known-constructors-ok/')
            .exec('.');

        // Then - clean run, no a2-known-constructors diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('a2-known-constructors');
    });
});
