import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — b11-marker-one-line (CONVENTIONS B11)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a marker wrapped onto a second comment line', async () => {
        // Given - a project whose Given sentence runs over two comment lines
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b11-marker-one-line/')
            .exec('.');

        // Then - the wrapped marker is reported
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('scenario.test.ts')).toContain('b11-marker-one-line');
    });

    test('accepts one-line markers and a note set apart by a blank line', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b11-marker-one-line-ok/')
            .exec('.');

        // Then - clean exit, no B11 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('b11-marker-one-line');
    });
});
