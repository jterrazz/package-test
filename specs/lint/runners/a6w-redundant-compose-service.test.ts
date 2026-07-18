import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

describe('lint — a6w-redundant-compose-service (CONVENTIONS A6)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns when composeService equals the derivable kebab-case name', async () => {
        // Given - a project violating A6
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a6w-redundant-compose-service/')
            .exec('.');

        // Then - oxlint reports the a6w-redundant-compose-service diagnostic
        // Warnings do not fail the run - the diagnostic is advisory
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('a6w-redundant-compose-service');
    });

    test('stays silent for a non-derivable composeService', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a6w-redundant-compose-service-ok/')
            .exec('.');

        // Then - clean run, no a6w-redundant-compose-service diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('a6w-redundant-compose-service');
    });
});
