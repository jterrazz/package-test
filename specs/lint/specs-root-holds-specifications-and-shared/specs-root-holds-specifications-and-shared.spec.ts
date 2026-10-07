import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as preset } from '../preset-lint.specification.js';

describe('specs-root-holds-specifications-and-shared', () => {
    test('a specs root of specifications and _shared/ passes', async () => {
        // Given - the specifications-and-shared tree
        const result = await preset
            .fixture(directory('./__fixtures__/specifications-and-shared/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a module and a __setup__/ directly under the specs root are refused', async () => {
        // Given - the strays tree
        const result = await preset.fixture(directory('./__fixtures__/strays/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/helpers.ts:1:1  names(specs-root-holds-specifications-and-shared)
                found: \`specs/helpers.ts\` breaks ls-lint's \`.*: exists:0\`
                why: The specs root holds its specification folders and the special folders of what they share alone — a repository suite is a first-level folder too: code every specification shares is \`<specs>/__setup__/\`, data the ground at the specs root.
                fix: move a file where it belongs — code into \`specs/__setup__/\` or the \`__setup__/\` of the one specification that reads it, data into the ground folder of its role
                read: docs/reference/linting.md#specs-root-holds-specifications-and-shared
        `);
    });
});
