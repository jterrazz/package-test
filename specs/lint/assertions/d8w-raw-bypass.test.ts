import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../lint.specification.js';

describe('lint — d8w-raw-bypass (CONVENTIONS D8)', () => {
    // Scalpel (D11): targeted rule-id presence/absence probe — a full-output snapshot would couple this rule test to the tool's diagnostic formatting.
    test('warns on a .raw substring assertion', async () => {
        // Given - a project tripping the D8 heuristic
        const result = await cli
            .fixture(directory('../../fixtures/lint-violations/d8w-raw-bypass/'))
            .exec('.');

        // Then - oxlint warns (advisory - warnings do not fail the run)
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('d8w-raw-bypass');
    });

    test('stays silent on the comparable text', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('../../fixtures/lint-violations/d8w-raw-bypass-ok/'))
            .exec('.');

        // Then - clean run, no d8w-raw-bypass diagnostic
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).not.toContain('d8w-raw-bypass');
    });
});
