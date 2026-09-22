import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../lint.specification.js';

describe('lint — i4-no-module-doubles (CONVENTIONS I4)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('rejects vi.mock and data-asset imports under src/', async () => {
        // Given - a project violating I4
        const result = await cli
            .fixture(directory('../../fixtures/lint-violations/i4-no-module-doubles/'))
            .exec('.');

        // Then - oxlint reports the i4-no-module-doubles diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain('i4-no-module-doubles');
    });

    test('accepts code-only module tests', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('../../fixtures/lint-violations/i4-no-module-doubles-ok/'))
            .exec('.');

        // Then - clean run, no i4-no-module-doubles diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).not.toContain('i4-no-module-doubles');
    });
});
