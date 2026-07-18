import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d2w-await-sync-matcher (CONVENTIONS D2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on await of a synchronous matcher', async () => {
        // Given - a project tripping the D2 heuristic
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d2w-await-sync-matcher/')
            .exec('.');

        // Then - oxlint warns (advisory - warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('d2w-await-sync-matcher');
    });

    test('stays silent without the redundant await', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d2w-await-sync-matcher-ok/')
            .exec('.');

        // Then - clean run, no d2w-await-sync-matcher diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d2w-await-sync-matcher');
    });
});
