import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — j5-lowercase-title (CONVENTIONS J5)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects an uppercase-led test title', async () => {
        // Given - a test whose title starts with a capital letter
        const result = await cli.fixture('$FIXTURES/lint-violations/j5-lowercase-title/').exec('.');

        // Then - oxlint reports the J5 violation
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('status.test.ts')).toContain('j5-lowercase-title');
    });

    test('accepts a lowercase-led test title', async () => {
        // Given - the compliant twin, title starting lowercase
        const result = await cli
            .fixture('$FIXTURES/lint-violations/j5-lowercase-title-ok/')
            .exec('.');

        // Then - clean exit, no J5 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('j5-lowercase-title');
    });
});
