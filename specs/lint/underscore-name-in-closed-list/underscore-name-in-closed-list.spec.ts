import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as preset } from '../preset-lint.specification.js';

describe('underscore-name-in-closed-list', () => {
    test('accepts a _setup/ under a facet and _shared/_setup/ at the root', async () => {
        // Given - the reserved tree
        const result = await preset.fixture(directory('./_fixtures/reserved/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('refuses a _ name off the closed list, and leaves what a _setup/ holds to the checker', async () => {
        // Given - the unlisted tree
        const result = await preset.fixture(directory('./_fixtures/unlisted/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/_drafts/:1:1  names(underscore-name-in-closed-list)
                found: \`specs/_drafts/\` breaks ls-lint's \`.dir: regex:(?:([^_].*)|(_setup)|(_expected)|(_fixtures)|(_requests)|(_seeds)|(_shared))\`
                why: A folder under a specs tree whose name starts with \`_\` is one of the closed list — \`_setup/\`, \`_fixtures/\`, \`_expected/\`, \`_requests/\`, \`_seeds/\`, \`_shared/\` — and any other \`_\` name is an error at the folder.
                fix: rename it to the reserved folder that says what it holds — \`_setup/\`, \`_expected/\`, \`_fixtures/\`, \`_requests/\`, \`_seeds/\`, \`_shared/\` — or drop the \`_\` if it is a subject
                read: docs/24-linting.md#underscore-name-in-closed-list
            specs/cli/orders/_archive/:1:1  names(underscore-name-in-closed-list)
                found: \`specs/cli/orders/_archive/\` breaks ls-lint's \`.dir: regex:(?:([^_].*)|(_setup)|(_expected)|(_fixtures)|(_requests)|(_seeds)|(_shared))\`
                why: A folder under a specs tree whose name starts with \`_\` is one of the closed list — \`_setup/\`, \`_fixtures/\`, \`_expected/\`, \`_requests/\`, \`_seeds/\`, \`_shared/\` — and any other \`_\` name is an error at the folder.
                fix: rename it to the reserved folder that says what it holds — \`_setup/\`, \`_expected/\`, \`_fixtures/\`, \`_requests/\`, \`_seeds/\`, \`_shared/\` — or drop the \`_\` if it is a subject
                read: docs/24-linting.md#underscore-name-in-closed-list
        `);
    });
});
