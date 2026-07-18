import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — a5-mode-with-server (CONVENTIONS A5)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a hardcoded mode next to a server option', async () => {
        // Given - a project violating A5
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a5-mode-with-server/')
            .exec('.');

        // Then - oxlint reports the a5-mode-with-server diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('a5-mode-with-server');
    });

    test('accepts a server-only options object', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a5-mode-with-server-ok/')
            .exec('.');

        // Then - clean run, no a5-mode-with-server diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('a5-mode-with-server');
    });
});
