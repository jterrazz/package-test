import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('c21w-ground-owned-by-one', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('warns on ground a single spec of the leaf reads', async () => {
        // Given - a tree violating C21
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c21w-ground-owned-by-one/'))
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
        expect(result.stderr).toMatch(`
            integration/orders/expected:1:1: warning jterrazz-check(c21w): found: \`expected/\`, read by \`total.spec.ts\` alone of the tests beside it · why: Ground in a leaf holding ≥ 2 node tests (\`.test.ts\`, \`.spec.ts\`) that a single one of them reads is a warning. · fix: give \`total.spec.ts\` a domain folder of its own, and move \`expected/\` into it · read: docs/19-linting.md#c21w-ground-owned-by-one
        `);
    });

    test('leaves a subject’s folder alone: its aspect files share its ground', async () => {
        // Given - two specs of GET /orders/:id in its standard folder, one of them reading the golden
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c21w-subject-leaf/'))
            .exec('specs');

        // Then - no warning: a folder of the golden's reader alone is one C30 would move it out of
        expect(result.exitCode).toBe(0);
        expect(result.stderr.text).toBe('');
    });

    test('accepts ground that sits beside the spec that reads it', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c21w-ground-owned-by-one-ok/'))
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
    });
});
