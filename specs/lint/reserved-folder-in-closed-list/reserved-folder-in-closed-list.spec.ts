import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('reserved-folder-in-closed-list', () => {
    test('a subject named with a reserved word, and code named so inside a _setup/, pass', async () => {
        // Given - the reserved tree
        const result = await checker.fixture(directory('./_fixtures/reserved/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('names off the closed list, a shared folder below the root and data in a _setup/ are refused', async () => {
        // Given - the unlisted tree
        const result = await checker.fixture(directory('./_fixtures/unlisted/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/_shared/notes.md:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`_shared/notes.md\`, which is no reserved folder
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the \`_\` names form a closed list: \`_setup/\` (the TypeScript that prepares specs), \`_seeds/\`, \`_requests/\`, \`_expected/\`, \`_fixtures/\` (the ground), and \`_shared/\` directly under the specs root.
                fix: \`specs/_shared/\` holds reserved folders alone — code in \`_shared/_setup/\`, data in the ground folder of its role
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/doubles/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`doubles/\`, a reserved name without its \`_\` and no subject: it holds no spec
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the \`_\` names form a closed list: \`_setup/\` (the TypeScript that prepares specs), \`_seeds/\`, \`_requests/\`, \`_expected/\`, \`_fixtures/\` (the ground), and \`_shared/\` directly under the specs root.
                fix: move its modules into \`_setup/\`, each test adapter named for the port it replaces (\`<port>.adapter.ts\`), and the paths that import them
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/_setup/_helpers/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`_helpers/\` inside a \`_setup/\`, a \`_\` name outside the closed list
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the \`_\` names form a closed list: \`_setup/\` (the TypeScript that prepares specs), \`_seeds/\`, \`_requests/\`, \`_expected/\`, \`_fixtures/\` (the ground), and \`_shared/\` directly under the specs root.
                fix: drop the \`_\` and name it for what it holds — the reserved folders, \`_setup/\`, \`_expected/\`, \`_fixtures/\`, \`_requests/\`, \`_seeds/\`, \`_shared/\`, sit beside a \`_setup/\`, never inside it
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/_setup/_seeds/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`_seeds/\` inside a \`_setup/\`, which holds code alone
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the \`_\` names form a closed list: \`_setup/\` (the TypeScript that prepares specs), \`_seeds/\`, \`_requests/\`, \`_expected/\`, \`_fixtures/\` (the ground), and \`_shared/\` directly under the specs root.
                fix: move it beside that \`_setup/\`, to \`specs/cli/orders/_seeds/\`, and the paths that name what it holds
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/_setup/rows.json:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`rows.json\` inside a \`_setup/\`, data where code alone belongs
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the \`_\` names form a closed list: \`_setup/\` (the TypeScript that prepares specs), \`_seeds/\`, \`_requests/\`, \`_expected/\`, \`_fixtures/\` (the ground), and \`_shared/\` directly under the specs root.
                fix: move it into the ground of its role beside that \`_setup/\` — \`specs/cli/orders/_fixtures/rows.json\`, or \`specs/cli/orders/_expected/rows.json\` when a test compares against it — and the paths that import or name it
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/_shared/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`_shared/\` below the specs root
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the \`_\` names form a closed list: \`_setup/\` (the TypeScript that prepares specs), \`_seeds/\`, \`_requests/\`, \`_expected/\`, \`_fixtures/\` (the ground), and \`_shared/\` directly under the specs root.
                fix: move what it holds into the reserved folders of \`cli/orders/\` itself — what a folder's leaves share sits in that folder's \`_setup/\` or ground; \`_shared/\` exists only as \`specs/_shared/\`, for what facets share
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/seeds/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`seeds/\`, a reserved name without its \`_\` and no subject: it holds no spec
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the \`_\` names form a closed list: \`_setup/\` (the TypeScript that prepares specs), \`_seeds/\`, \`_requests/\`, \`_expected/\`, \`_fixtures/\` (the ground), and \`_shared/\` directly under the specs root.
                fix: rename it \`_seeds/\`, and the paths that name it
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/shared/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`shared/\` below the specs root
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the \`_\` names form a closed list: \`_setup/\` (the TypeScript that prepares specs), \`_seeds/\`, \`_requests/\`, \`_expected/\`, \`_fixtures/\` (the ground), and \`_shared/\` directly under the specs root.
                fix: move what it holds into the reserved folders of \`cli/orders/\` itself — what a folder's leaves share sits in that folder's \`_setup/\` or ground; \`_shared/\` exists only as \`specs/_shared/\`, for what facets share
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/shared/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`shared/\`, a reserved name without its \`_\` and no subject: it holds no spec
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the \`_\` names form a closed list: \`_setup/\` (the TypeScript that prepares specs), \`_seeds/\`, \`_requests/\`, \`_expected/\`, \`_fixtures/\` (the ground), and \`_shared/\` directly under the specs root.
                fix: rename it \`_shared/\`, and the paths that name it
                read: docs/reference/linting.md#reserved-folder-in-closed-list
        `);
    });
});
