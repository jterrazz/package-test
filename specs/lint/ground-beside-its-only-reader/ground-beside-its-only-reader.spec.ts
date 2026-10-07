import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('ground-beside-its-only-reader', () => {
    test('refuses ground a single spec of the leaf reads', async () => {
        // Given - a tree violating `ground-beside-its-only-reader`
        const result = await checker
            .fixture(directory('./__fixtures__/ground-beside-its-only-reader/'))
            .run();

        // Then - the pass names the file and what to do about it
        expect(result.report).toMatch(`
            specs/integration/orders/__expected__:1:1  jterrazz-check(ground-beside-its-only-reader)
                found: \`__expected__/\`, read by \`total.spec.ts\` alone of the tests beside it
                why: Ground in a leaf holding ≥ 2 node tests (\`.test.ts\`, \`.spec.ts\`) that a single one of them reads is an error.
                fix: give \`total.spec.ts\` a domain folder of its own, and move \`__expected__/\` into it
                read: docs/reference/linting.md#ground-beside-its-only-reader
        `);
    });

    test('leaves a subject’s folder alone: its aspect files share its ground', async () => {
        // Given - two specs of GET /orders/:id in its standard folder, one of them reading the golden
        const result = await checker
            .fixture(directory('./__fixtures__/ground-beside-its-only-reader-subject-leaf/'))
            .run();

        // Then - no warning: a folder of the golden's reader alone is one `spec-in-subject-folder` would move it out of
        expect(result.report).toMatch('');
    });

    test('accepts ground that sits beside the spec that reads it', async () => {
        // Given - the compliant twin
        const result = await checker
            .fixture(directory('./__fixtures__/ground-beside-its-only-reader-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
