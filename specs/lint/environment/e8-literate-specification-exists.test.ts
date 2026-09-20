import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — e8-literate-specification-exists (CONVENTIONS E8)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a literate door pointing at no file', async () => {
        // Given - a project violating E8
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e8-literate-specification-exists/')
            .exec('.');

        // Then - the diagnostic names the rule
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('vitest.config.ts')).toContain(
            'e8-literate-specification-exists',
        );
    });

    test('accepts a literate door that resolves', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e8-literate-specification-exists-ok/')
            .exec('.');

        // Then - clean exit, no E8 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('e8-literate-specification-exists');
    });
});
