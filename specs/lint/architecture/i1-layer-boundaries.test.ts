import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../lint.specification.js';

describe('lint — i1-layer-boundaries (CONVENTIONS I1)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects an external dependency imported from core/', async () => {
        // Given - a project violating I1
        const result = await cli
            .fixture(directory('../../fixtures/lint-violations/i1-layer-boundaries/'))
            .exec('.');

        // Then - oxlint reports the i1-layer-boundaries diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain('i1-layer-boundaries');
    });

    test('accepts node builtins and in-layer imports', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('../../fixtures/lint-violations/i1-layer-boundaries-ok/'))
            .exec('.');

        // Then - clean run, no i1-layer-boundaries diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).not.toContain('i1-layer-boundaries');
    });
});
