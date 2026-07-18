import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — b6w-redundant-env-url (CONVENTIONS B6)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a hand-wired DATABASE_URL from connectionString', async () => {
        // Given - a project violating B6
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b6w-redundant-env-url/')
            .exec('.');

        // Then - oxlint reports the b6w-redundant-env-url diagnostic
        // Warnings do not fail the run - the diagnostic is advisory
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('b6w-redundant-env-url');
    });

    test('stays silent for non-URL env variables', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b6w-redundant-env-url-ok/')
            .exec('.');

        // Then - clean run, no b6w-redundant-env-url diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('b6w-redundant-env-url');
    });
});
