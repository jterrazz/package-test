import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — b12-marker-between-statements (CONVENTIONS B12)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a marker buried in a declarator chain', async () => {
        // Given - a project whose Then sits inside `const a = …, b = …`
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b12-marker-between-statements/')
            .exec('.');

        // Then - the buried marker is reported
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('scenario.test.ts')).toContain('b12-marker-between-statements');
    });

    test('accepts a chain whose markers sit between statements', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b12-marker-between-statements-ok/')
            .exec('.');

        // Then - clean exit, no B12 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('b12-marker-between-statements');
    });
});
