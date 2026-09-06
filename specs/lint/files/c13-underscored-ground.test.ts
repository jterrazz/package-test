import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — c13-underscored-ground (CONVENTIONS C13)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a pre-14 ground directory beside a spec', async () => {
        // Given - a project whose goldens still sit in expected/, not _expected/
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c13-underscored-ground/')
            .exec('.');

        // Then - oxlint reports the c13-underscored-ground diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('c13-underscored-ground');
    });

    test('accepts ground named with the leading underscore', async () => {
        // Given - the compliant twin, its goldens under _expected/
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c13-underscored-ground-ok/')
            .exec('.');

        // Then - clean run, no c13-underscored-ground diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('c13-underscored-ground');
    });
});
