import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — f4-no-test-to-test-import (CONVENTIONS F4)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a test file importing another test file', async () => {
        // Given - a project violating F4
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f4-no-test-to-test-import/')
            .exec('.');

        // Then - oxlint reports the f4-no-test-to-test-import diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('f4-no-test-to-test-import');
    });

    test('accepts importing the fixtures neighbour instead', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f4-no-test-to-test-import-ok/')
            .exec('.');

        // Then - clean run, no f4-no-test-to-test-import diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('f4-no-test-to-test-import');
    });
});
