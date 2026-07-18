import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — a1-specification-file (CONVENTIONS A1)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a specification.cli() call outside a *.specification.ts file', async () => {
        // Given - a project violating A1
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a1-specification-file/')
            .exec('.');

        // Then - oxlint reports the a1-specification-file diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('a1-specification-file');
    });

    test('accepts the same runner created in a *.specification.ts file', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a1-specification-file-ok/')
            .exec('.');

        // Then - clean run, no a1-specification-file diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('a1-specification-file');
    });
});
