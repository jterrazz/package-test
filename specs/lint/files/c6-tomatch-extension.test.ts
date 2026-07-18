import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — c6-tomatch-extension (CONVENTIONS C6)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a toMatch fixture name without its extension', async () => {
        // Given - a project violating C6
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c6-tomatch-extension/')
            .exec('.');

        // Then - oxlint reports the c6-tomatch-extension diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('c6-tomatch-extension');
    });

    test('accepts extensions and directory-tree snapshots', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c6-tomatch-extension-ok/')
            .exec('.');

        // Then - clean run, no c6-tomatch-extension diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('c6-tomatch-extension');
    });
});
