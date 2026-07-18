import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — b2-known-fixture-marker (CONVENTIONS B2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects an unknown $-marker in a .fixture() path', async () => {
        // Given - a project violating B2
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b2-known-fixture-marker/')
            .exec('.');

        // Then - oxlint reports the b2-known-fixture-marker diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('b2-known-fixture-marker');
    });

    test('accepts the $FIXTURES marker', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b2-known-fixture-marker-ok/')
            .exec('.');

        // Then - clean run, no b2-known-fixture-marker diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('b2-known-fixture-marker');
    });
});
