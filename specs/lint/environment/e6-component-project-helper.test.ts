import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — e6-component-project-helper (CONVENTIONS E6)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a hand-rolled browser project', async () => {
        // Given - a config wiring Browser Mode by hand
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e6-component-project-helper/')
            .exec('.');

        // Then - oxlint reports the e6-component-project-helper diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('e6-component-project-helper');
    });

    test('accepts the project the helper builds', async () => {
        // Given - the compliant twin: `component()` beside `unit()`
        const result = await cli
            .fixture('$FIXTURES/lint-violations/e6-component-project-helper-ok/')
            .exec('.');

        // Then - clean run, no e6-component-project-helper diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('e6-component-project-helper');
    });
});
