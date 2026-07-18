import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — b9w-product-command (CONVENTIONS B9)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns when the cli binary is a third-party node_modules/.bin', async () => {
        // Given - a runner pointed straight at node_modules/.bin/oxlint
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b9w-product-command/')
            .exec('.');

        // Then - oxlint warns (advisory - warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('b9w-product-command');
    });

    test('stays silent on the product command wrapper', async () => {
        // Given - the compliant twin, pointed at the product's own bin script
        const result = await cli
            .fixture('$FIXTURES/lint-violations/b9w-product-command-ok/')
            .exec('.');

        // Then - clean run, no b9w-product-command diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('b9w-product-command');
    });
});
