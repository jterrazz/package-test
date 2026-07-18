import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — c7-seeds-sql-only (CONVENTIONS C7)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a non-.sql file under seeds/', async () => {
        // Given - a project violating C7
        const result = await cli.fixture('$FIXTURES/lint-violations/c7-seeds-sql-only/').exec('.');

        // Then - oxlint reports the c7-seeds-sql-only diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('c7-seeds-sql-only');
    });

    test('accepts a seeds/ directory of .sql fragments only', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c7-seeds-sql-only-ok/')
            .exec('.');

        // Then - clean run, no c7-seeds-sql-only diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('c7-seeds-sql-only');
    });
});
