import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — c8-referenced-fixture-exists (CONVENTIONS C8)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a toMatch referencing a missing fixture', async () => {
        // Given - a project violating C8
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c8-referenced-fixture-exists/')
            .exec('.');

        // Then - oxlint reports the c8-referenced-fixture-exists diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('c8-referenced-fixture-exists');
    });

    test('accepts a reference that exists on disk', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c8-referenced-fixture-exists-ok/')
            .exec('.');

        // Then - clean run, no c8-referenced-fixture-exists diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('c8-referenced-fixture-exists');
    });
});
