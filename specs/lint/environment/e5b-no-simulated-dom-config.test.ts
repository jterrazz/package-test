import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — e5b-no-simulated-dom-config (CONVENTIONS E5b)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a simulated DOM declared for a whole project', async () => {
        // Given - a vitest config naming happy-dom as its environment
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e5b-no-simulated-dom-config/')
            .exec('.');

        // Then - oxlint reports the e5b-no-simulated-dom-config diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('e5b-no-simulated-dom-config');
    });

    test('accepts a real runtime, which is not a drawing of one', async () => {
        // Given - the compliant twin: the node environment, stated plainly
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e5b-no-simulated-dom-config-ok/')
            .exec('.');

        // Then - clean run, no e5b-no-simulated-dom-config diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('e5b-no-simulated-dom-config');
    });
});
