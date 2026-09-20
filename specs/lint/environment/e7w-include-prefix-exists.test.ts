import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — e7w-include-prefix-exists (CONVENTIONS E7)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on an include whose folder does not exist', async () => {
        // Given - a project violating E7
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e7w-include-prefix-exists/')
            .exec('.');

        // Then - oxlint warns (advisory — warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('e7w-include-prefix-exists');
    });

    test('accepts an include rooted in a folder that exists', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e7w-include-prefix-exists-ok/')
            .exec('.');

        // Then - clean exit, no E7 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('e7w-include-prefix-exists');
    });
});
