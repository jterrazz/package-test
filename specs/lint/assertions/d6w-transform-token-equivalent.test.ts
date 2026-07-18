import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d6w-transform-token-equivalent (CONVENTIONS D6)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns when a transform only rewrites output into known tokens', async () => {
        // Given - a project violating D6
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d6w-transform-token-equivalent/')
            .exec('.');

        // Then - oxlint reports the d6w-transform-token-equivalent diagnostic
        // Warnings do not fail the run - the diagnostic is advisory
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d6w-transform-token-equivalent');
    });

    test('stays silent for a transform covering real applicative noise', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d6w-transform-token-equivalent-ok/')
            .exec('.');

        // Then - clean run, no d6w-transform-token-equivalent diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d6w-transform-token-equivalent');
    });
});
