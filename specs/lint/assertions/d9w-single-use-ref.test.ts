import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d9w-single-use-ref (CONVENTIONS D9)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a single-use capture ref', async () => {
        // Given - a project tripping the D9 heuristic
        const result = await cli.fixture('$FIXTURES/lint-violations/d9w-single-use-ref/').exec('.');

        // Then - oxlint warns (advisory - warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d9w-single-use-ref');
    });

    test('stays silent for a plain matcher', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d9w-single-use-ref-ok/')
            .exec('.');

        // Then - clean run, no d9w-single-use-ref diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d9w-single-use-ref');
    });
});
