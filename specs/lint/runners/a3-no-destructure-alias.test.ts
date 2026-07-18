import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — a3-no-destructure-alias (CONVENTIONS A3)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects destructuring the runner with an alias', async () => {
        // Given - a project violating A3
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a3-no-destructure-alias/')
            .exec('.');

        // Then - oxlint reports the a3-no-destructure-alias diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('a3-no-destructure-alias');
    });

    test('accepts the canonical destructured names', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a3-no-destructure-alias-ok/')
            .exec('.');

        // Then - clean run, no a3-no-destructure-alias diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('a3-no-destructure-alias');
    });
});
