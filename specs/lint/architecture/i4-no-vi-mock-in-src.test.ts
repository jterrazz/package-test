import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — i4-no-vi-mock-in-src (CONVENTIONS I4)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects vi.mock and data-asset imports under src/', async () => {
        // Given - a project violating I4
        const result = await cli
            .fixture('$FIXTURES/lint-violations/i4-no-vi-mock-in-src/')
            .exec('.');

        // Then - oxlint reports the i4-no-vi-mock-in-src diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('i4-no-vi-mock-in-src');
    });

    test('accepts code-only module tests', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/i4-no-vi-mock-in-src-ok/')
            .exec('.');

        // Then - clean run, no i4-no-vi-mock-in-src diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('i4-no-vi-mock-in-src');
    });
});
