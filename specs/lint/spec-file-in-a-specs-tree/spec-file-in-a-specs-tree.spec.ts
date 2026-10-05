import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as preset } from '../preset-lint.specification.js';

describe('spec-file-in-a-specs-tree', () => {
    test('accepts a .spec.ts under its specification', async () => {
        // Given - the placed tree
        const result = await preset.fixture(directory('./_fixtures/placed/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('refuses a .spec.ts in a folder outside every specs tree, a sub-extension included', async () => {
        // Given - the stray tree
        const result = await preset.fixture(directory('./_fixtures/stray/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/orders/listing.daily.spec.ts:1:1  names(spec-file-in-a-specs-tree)
                found: \`src/orders/listing.daily.spec.ts\` breaks ls-lint's \`.*.spec.ts: exists:0\`
                why: A \`.spec.ts\` — the ASSEMBLED product — sits under a \`specs/\` tree; one in any other folder is an error at the file.
                fix: move it under \`specs/<specification>/\`, or rename it \`.test.ts\` beside the module it covers
                read: docs/reference/linting.md#spec-file-in-a-specs-tree
            src/orders/listing.spec.ts:1:1  names(spec-file-in-a-specs-tree)
                found: \`src/orders/listing.spec.ts\` breaks ls-lint's \`.spec.ts: exists:0\`
                why: A \`.spec.ts\` — the ASSEMBLED product — sits under a \`specs/\` tree; one in any other folder is an error at the file.
                fix: move it under \`specs/<specification>/\`, or rename it \`.test.ts\` beside the module it covers
                read: docs/reference/linting.md#spec-file-in-a-specs-tree
        `);
    });
});
