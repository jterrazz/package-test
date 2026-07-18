import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — b5-await-using (CONVENTIONS B5)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a docker-aware runner result bound without await using', async () => {
        // Given - a project violating B5
        const result = await cli.fixture('$FIXTURES/lint-violations/b5-await-using/').exec('.');

        // Then - oxlint reports the b5-await-using diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('b5-await-using');
    });

    test('accepts the await using binding', async () => {
        // Given - the compliant twin
        const result = await cli.fixture('$FIXTURES/lint-violations/b5-await-using-ok/').exec('.');

        // Then - clean run, no b5-await-using diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('b5-await-using');
    });
});
