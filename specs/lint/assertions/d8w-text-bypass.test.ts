import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d8w-text-bypass (CONVENTIONS D8)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a raw .text assertion', async () => {
        // Given - a project tripping the D8 heuristic
        const result = await cli.fixture('$FIXTURES/lint-violations/d8w-text-bypass/').exec('.');

        // Then - oxlint warns (advisory - warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d8w-text-bypass');
    });

    test('stays silent on the typed subject', async () => {
        // Given - the compliant twin
        const result = await cli.fixture('$FIXTURES/lint-violations/d8w-text-bypass-ok/').exec('.');

        // Then - clean run, no d8w-text-bypass diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d8w-text-bypass');
    });
});
