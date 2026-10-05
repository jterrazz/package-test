import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as preset } from '../preset-lint.specification.js';

describe('specs-root-holds-specifications-and-shared', () => {
    test('a specs root of specifications and _shared/ passes', async () => {
        // Given - the specifications-and-shared tree
        const result = await preset
            .fixture(directory('./_fixtures/specifications-and-shared/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a module and a _setup/ directly under the specs root are refused', async () => {
        // Given - the strays tree
        const result = await preset.fixture(directory('./_fixtures/strays/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/_setup/:1:1  names(specs-root-holds-specifications-and-shared)
                found: \`specs/_setup/\` breaks ls-lint's \`.dir: regex:(?:([^_].*)|(_[^s].*)|(_s[^e].*)|(_se[^t].*)|(_set[^u].*)|(_setu[^p].*)|(_)|(_s)|(_se)|(_set)|(_setu)|(_setup.+))\`
                why: The specs root holds its specification folders and \`_shared/\` alone — a repository suite is a first-level folder too.
                fix: move a file where it belongs — code into \`specs/_shared/_setup/\` or the \`_setup/\` of the one specification that reads it, data into the ground folder of its role — and a \`_setup/\` to \`specs/_shared/_setup/\`
                read: docs/reference/linting.md#specs-root-holds-specifications-and-shared
            specs/helpers.ts:1:1  names(specs-root-holds-specifications-and-shared)
                found: \`specs/helpers.ts\` breaks ls-lint's \`.*: exists:0\`
                why: The specs root holds its specification folders and \`_shared/\` alone — a repository suite is a first-level folder too.
                fix: move a file where it belongs — code into \`specs/_shared/_setup/\` or the \`_setup/\` of the one specification that reads it, data into the ground folder of its role — and a \`_setup/\` to \`specs/_shared/_setup/\`
                read: docs/reference/linting.md#specs-root-holds-specifications-and-shared
        `);
    });
});
