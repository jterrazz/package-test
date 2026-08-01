import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — c10-contracts-boundary (CONVENTIONS C10)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a test importing an internal unit contract', async () => {
        // Given - a test reaching into contracts/http/ instead of the facade
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c10-contracts-boundary/')
            .exec('.');

        // Then - oxlint reports the c10-contracts-boundary diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('c10-contracts-boundary');
    });

    test('accepts a test importing the contracts facade', async () => {
        // Given - the compliant twin: the test imports *.contracts.ts
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c10-contracts-boundary-ok/')
            .exec('.');

        // Then - clean run, no c10-contracts-boundary diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('c10-contracts-boundary');
    });
});
