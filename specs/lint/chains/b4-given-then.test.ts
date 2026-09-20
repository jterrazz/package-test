import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — b4-given-then (CONVENTIONS B4)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects tests missing Given or Then markers', async () => {
        // Given - a project whose tests miss Given, Then, or both
        const result = await cli.fixture('$FIXTURES/lint-violations/b4-given-then/').exec('.');

        // Then - oxlint reports one diagnostic per missing marker (1 + 1 + 2).
        // Counted by DIAGNOSTIC, not by name: every message ends with its
        // Generated anchor, so the rule name appears twice on each line
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('scenario.test.ts')).toContain('b4-given-then');
        const missing = result.stdout.text.match(/jterrazz\(b4-given-then\)/gu) ?? [];
        expect(missing).toHaveLength(4);
    });

    test('rejects Given declared after Then', async () => {
        // Given - a project whose tests order the markers wrongly
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b4-given-then-position/')
            .exec('.');

        // Then - the position upgrade reports one diagnostic per test (2)
        expect(result.exitCode).toBe(1);
        const hits = result.stdout.text.match(/jterrazz\(b4-given-then\)/gu) ?? [];
        expect(hits).toHaveLength(2);
    });

    test('accepts both markers, optional When, and skipIf wrappers', async () => {
        // Given - the compliant twin: Given+Then, a When variant, a skipIf test
        const result = await cli.fixture('$FIXTURES/lint-violations/b4-given-then-ok/').exec('.');

        // Then - clean exit, no B4 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('b4-given-then');
    });
});
