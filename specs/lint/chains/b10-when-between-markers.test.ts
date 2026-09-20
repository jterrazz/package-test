import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — b10-when-between-markers (CONVENTIONS B10)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a When written outside the two mandatory markers', async () => {
        // Given - a project narrating the action before the Given and after the Then
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b10-when-between-markers/')
            .exec('.');

        // Then - one diagnostic per misplaced marker
        expect(result.exitCode).toBe(1);
        const hits = result.stdout.text.match(/jterrazz\(b10-when-between-markers\)/gu) ?? [];
        expect(hits).toHaveLength(2);
    });

    test('accepts a When between Given and Then, and a test without one', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b10-when-between-markers-ok/')
            .exec('.');

        // Then - clean exit, no B10 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('b10-when-between-markers');
    });
});
