import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — b8-kebab-trigger (CONVENTIONS B8)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a non-kebab-case job name in .trigger()', async () => {
        // Given - a project violating B8
        const result = await cli.fixture('$FIXTURES/lint-violations/b8-kebab-trigger/').exec('.');

        // Then - oxlint reports the b8-kebab-trigger diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('b8-kebab-trigger');
    });

    test('accepts a kebab-case job name', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b8-kebab-trigger-ok/')
            .exec('.');

        // Then - clean run, no b8-kebab-trigger diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('b8-kebab-trigger');
    });
});
