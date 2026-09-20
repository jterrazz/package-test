import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — e4w-project-binding (CONVENTIONS E4)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a facet root collected under another name', async () => {
        // Given - a project violating E4
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e4w-project-binding/')
            .exec('.');

        // Then - oxlint warns (advisory — warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('e4w-project-binding');
    });

    test('accepts a project named for the facet it collects', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e4w-project-binding-ok/')
            .exec('.');

        // Then - clean exit, no E4 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('e4w-project-binding');
    });
});
