import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('ground-beside-its-only-reader', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('warns on ground a single spec of the leaf reads', async () => {
        // Given - a tree violating `ground-beside-its-only-reader`
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/ground-beside-its-only-reader/'))
            .exec('specs');

        // Then - the pass names the file and what to do about it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
        expect(result.stderr).toMatch(`
            integration/orders/_expected:1:1: warning jterrazz-check(ground-beside-its-only-reader): found: \`_expected/\`, read by \`total.spec.ts\` alone of the tests beside it · why: Ground in a leaf holding ≥ 2 node tests (\`.test.ts\`, \`.spec.ts\`) that a single one of them reads is a warning. · fix: give \`total.spec.ts\` a domain folder of its own, and move \`_expected/\` into it · read: docs/19-linting.md#ground-beside-its-only-reader
        `);
    });

    test('leaves a subject’s folder alone: its aspect files share its ground', async () => {
        // Given - two specs of GET /orders/:id in its standard folder, one of them reading the golden
        const result = await cli
            .fixture(
                directory(
                    './_fixtures/lint-violations/ground-beside-its-only-reader-subject-leaf/',
                ),
            )
            .exec('specs');

        // Then - no warning: a folder of the golden's reader alone is one `spec-in-subject-folder` would move it out of
        expect(result.exitCode).toBe(0);
        expect(result.stderr.text).toBe('');
    });

    test('accepts ground that sits beside the spec that reads it', async () => {
        // Given - the compliant twin
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/ground-beside-its-only-reader-ok/'))
            .exec('specs');

        // Then - the clean summary
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: nothing held
        `);
    });
});
