import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — f3-specs-public-entry (CONVENTIONS F3)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a deep internal src import from specs/', async () => {
        // Given - a project violating F3
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f3-specs-public-entry/')
            .exec('.');

        // Then - oxlint reports the f3-specs-public-entry diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('f3-specs-public-entry');
    });

    test('accepts the public entry import', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f3-specs-public-entry-ok/')
            .exec('.');

        // Then - clean run, no f3-specs-public-entry diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('f3-specs-public-entry');
    });
});
