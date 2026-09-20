import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — e2-preset-config (CONVENTIONS E2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a config that does not start from the preset', async () => {
        // Given - a project violating E2
        const result = await cli.fixture('$FIXTURES/lint-violations/e2-preset-config/').exec('.');

        // Then - the diagnostic names the rule
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('vitest.config.ts')).toContain('e2-preset-config');
    });

    test('accepts a config that starts from the preset', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e2-preset-config-ok/')
            .exec('.');

        // Then - clean exit, no E2 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('e2-preset-config');
    });
});
