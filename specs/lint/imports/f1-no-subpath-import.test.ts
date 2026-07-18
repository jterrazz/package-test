import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — f1-no-subpath-import (CONVENTIONS F1)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects an @jterrazz/test subpath import', async () => {
        // Given - a project violating F1
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f1-no-subpath-import/')
            .exec('.');

        // Then - oxlint reports the f1-no-subpath-import diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('f1-no-subpath-import');
    });

    test('accepts the single public entry point', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f1-no-subpath-import-ok/')
            .exec('.');

        // Then - clean run, no f1-no-subpath-import diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('f1-no-subpath-import');
    });
});
