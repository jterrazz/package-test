import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — f2-no-test-imports-in-prod (CONVENTIONS F2)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a vitest import from production code', async () => {
        // Given - a project violating F2
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f2-no-test-imports-in-prod/')
            .exec('.');

        // Then - oxlint reports the f2-no-test-imports-in-prod diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('f2-no-test-imports-in-prod');
    });

    test('accepts production code without test artefacts', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/f2-no-test-imports-in-prod-ok/')
            .exec('.');

        // Then - clean run, no f2-no-test-imports-in-prod diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('f2-no-test-imports-in-prod');
    });
});
