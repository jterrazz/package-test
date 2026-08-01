import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — c11-contract-data-pairing (CONVENTIONS C11)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects an orphan payload in a provider folder', async () => {
        // Given - a *.response.json whose owning contract does not exist
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c11-contract-data-pairing/')
            .exec('.');

        // Then - oxlint reports the c11-contract-data-pairing diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('c11-contract-data-pairing');
    });

    test('accepts payloads paired with their contract', async () => {
        // Given - the compliant twin: every payload has its <stem>.ts sibling
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c11-contract-data-pairing-ok/')
            .exec('.');

        // Then - clean run, no c11-contract-data-pairing diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('c11-contract-data-pairing');
    });
});
