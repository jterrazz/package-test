import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — d2-await-io-matcher (CONVENTIONS D2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects an un-awaited IO matcher', async () => {
        // Given - a project violating D2
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d2-await-io-matcher/')
            .exec('.');

        // Then - oxlint reports the d2-await-io-matcher diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('d2-await-io-matcher');
    });

    test('accepts an awaited IO matcher', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/d2-await-io-matcher-ok/')
            .exec('.');

        // Then - clean run, no d2-await-io-matcher diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('d2-await-io-matcher');
    });
});
