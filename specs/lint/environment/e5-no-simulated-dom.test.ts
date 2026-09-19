import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — e5-no-simulated-dom (CONVENTIONS E5)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a simulated-DOM pragma in a test file', async () => {
        // Given - a test file asking vitest for happy-dom
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e5-no-simulated-dom/')
            .exec('.');

        // Then - oxlint reports the e5-no-simulated-dom diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('e5-no-simulated-dom');
    });

    test('accepts a test that needs no environment at all', async () => {
        // Given - the compliant twin: a plain module test under node
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e5-no-simulated-dom-ok/')
            .exec('.');

        // Then - clean run, no e5-no-simulated-dom diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('e5-no-simulated-dom');
    });
});
