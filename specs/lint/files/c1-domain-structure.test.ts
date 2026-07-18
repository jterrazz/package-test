import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — c1-domain-structure (CONVENTIONS C1)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a test placed directly at the facet root', async () => {
        // Given - a project with specs/widget/widget.test.ts (no domain folder)
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c1-domain-structure/')
            .exec('.');

        // Then - oxlint reports the C1 placement violation
        expect(result.exitCode).toBe(1);
        expect(result.stdout.grep('widget.test.ts')).toContain('c1-domain-structure');
    });

    test('accepts a test nested at facet/domain depth', async () => {
        // Given - the compliant twin, specs/widget/status/status.test.ts
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c1-domain-structure-ok/')
            .exec('.');

        // Then - clean exit, no C1 diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('c1-domain-structure');
    });
});
