import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — g4-no-dom-in-module-test (CONVENTIONS G4)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a DOM global in a module test', async () => {
        // Given - a `.test.ts` reaching for `document`
        const result = await cli
            .fixture('$FIXTURES/lint-violations/g4-no-dom-in-module-test/')
            .exec('.');

        // Then - oxlint reports the g4-no-dom-in-module-test diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('g4-no-dom-in-module-test');
    });

    test('accepts the same document where the kind has one', async () => {
        // Given - the compliant twin: the rendered kind, a `.test.tsx`
        const result = await cli
            .fixture('$FIXTURES/lint-violations/g4-no-dom-in-module-test-ok/')
            .exec('.');

        // Then - clean run, no g4-no-dom-in-module-test diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('g4-no-dom-in-module-test');
    });
});
