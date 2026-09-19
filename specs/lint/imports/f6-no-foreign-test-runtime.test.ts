import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — f6-no-foreign-test-runtime (CONVENTIONS F6)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a second renderer imported by a test', async () => {
        // Given - a test file reaching for Testing Library
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f6-no-foreign-test-runtime/')
            .exec('.');

        // Then - oxlint reports the f6-no-foreign-test-runtime diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('f6-no-foreign-test-runtime');
    });

    test("accepts the framework's own chain", async () => {
        // Given - the compliant twin: `component.render()` and the vocabulary
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f6-no-foreign-test-runtime-ok/')
            .exec('.');

        // Then - clean run, no f6-no-foreign-test-runtime diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('f6-no-foreign-test-runtime');
    });
});
