import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — j2-no-sleep-in-specs (CONVENTIONS J2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects an arbitrary setTimeout sleep in a spec', async () => {
        // Given - a project violating J2
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j2-no-sleep-in-specs/')
            .exec('.');

        // Then - oxlint reports the j2-no-sleep-in-specs diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('j2-no-sleep-in-specs');
    });

    test('accepts framework-level synchronisation', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j2-no-sleep-in-specs-ok/')
            .exec('.');

        // Then - clean run, no j2-no-sleep-in-specs diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('j2-no-sleep-in-specs');
    });
});
