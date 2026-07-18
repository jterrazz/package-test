import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — c2-http-only-requests (CONVENTIONS C2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a non-.http file under requests/', async () => {
        // Given - a project violating C2
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c2-http-only-requests/')
            .exec('.');

        // Then - oxlint reports the c2-http-only-requests diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('c2-http-only-requests');
    });

    test('accepts a requests/ directory of .http files only', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c2-http-only-requests-ok/')
            .exec('.');

        // Then - clean run, no c2-http-only-requests diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('c2-http-only-requests');
    });
});
