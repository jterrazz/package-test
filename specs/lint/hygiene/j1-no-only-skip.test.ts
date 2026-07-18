import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — j1-no-only-skip (CONVENTIONS J1)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a committed test.only', async () => {
        // Given - a project whose spec pins a test with .only
        const result = await cli.fixture('$FIXTURES/lint-violations/j1-no-only-skip/').exec('.');

        // Then - oxlint fails with the J1 diagnostic on the offending file
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('scenario.test.ts')).toContain('j1-no-only-skip');
        expect(result.stdout.grep('scenario.test.ts')).toContain('test.only');
    });

    test('accepts the same project without the modifier', async () => {
        // Given - the compliant twin (plain test(), no .only/.skip)
        const result = await cli.fixture('$FIXTURES/lint-violations/j1-no-only-skip-ok/').exec('.');

        // Then - clean exit, no J1 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('j1-no-only-skip');
    });
});
