import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../lint.specification.js';

describe('lint — c13-bare-ground (CONVENTIONS C13)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects a 16.x ground directory beside a spec', async () => {
        // Given - a project whose goldens still sit in expected/, not expected/
        const result = await cli
            .fixture(directory('../../fixtures/lint-violations/c13-bare-ground/'))
            .exec('.');

        // Then - oxlint reports the c13-bare-ground diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain('c13-bare-ground');
    });

    test('accepts ground named with the bare reserved name', async () => {
        // Given - the compliant twin, its goldens under expected/
        const result = await cli
            .fixture(directory('../../fixtures/lint-violations/c13-bare-ground-ok/'))
            .exec('.');

        // Then - clean run, no c13-bare-ground diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).not.toContain('c13-bare-ground');
    });
});
