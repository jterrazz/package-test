import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('reserved-folder-in-closed-list', () => {
    test('a subject named with a reserved word, and code named so inside a __setup__/, pass', async () => {
        // Given - the reserved tree
        const result = await checker.fixture(directory('./__fixtures__/reserved/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('names off the closed list, a shared folder below the root and data in a __setup__/ are refused', async () => {
        // Given - the unlisted tree
        const result = await checker.fixture(directory('./__fixtures__/unlisted/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/doubles/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`doubles/\`, a special folder spelt without its marks, and no subject: it holds no spec
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the special folders form a closed list: \`__setup__/\` (the TypeScript that prepares specs), \`__seeds__/\`, \`__requests__/\`, \`__expected__/\`, \`__fixtures__/\` (the ground); at the specs root, they hold what the specifications share, as a folder's hold what its leaves share.
                fix: move its modules into \`__setup__/\`, each test adapter named for the port it replaces (\`<port>.adapter.ts\`), and the paths that import them
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/__setup__/__seeds__/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`__seeds__/\` inside a \`__setup__/\`, which holds code alone
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the special folders form a closed list: \`__setup__/\` (the TypeScript that prepares specs), \`__seeds__/\`, \`__requests__/\`, \`__expected__/\`, \`__fixtures__/\` (the ground); at the specs root, they hold what the specifications share, as a folder's hold what its leaves share.
                fix: move it beside that \`__setup__/\`, to \`specs/cli/orders/__seeds__/\`, and the paths that name what it holds
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/__setup__/_helpers/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`_helpers/\` inside a \`__setup__/\`, where every folder is the code's own
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the special folders form a closed list: \`__setup__/\` (the TypeScript that prepares specs), \`__seeds__/\`, \`__requests__/\`, \`__expected__/\`, \`__fixtures__/\` (the ground); at the specs root, they hold what the specifications share, as a folder's hold what its leaves share.
                fix: drop the \`_\` and name it for what it holds: the special folders, \`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`, sit beside a \`__setup__/\`, never inside it
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/__setup__/rows.json:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`rows.json\` inside a \`__setup__/\`, data where code alone belongs
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the special folders form a closed list: \`__setup__/\` (the TypeScript that prepares specs), \`__seeds__/\`, \`__requests__/\`, \`__expected__/\`, \`__fixtures__/\` (the ground); at the specs root, they hold what the specifications share, as a folder's hold what its leaves share.
                fix: move it into the ground of its role beside that \`__setup__/\` (\`specs/cli/orders/__fixtures__/rows.json\`, or \`specs/cli/orders/__expected__/rows.json\` when a test compares against it) and the paths that import or name it
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/seeds/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`seeds/\`, a special folder spelt without its marks, and no subject: it holds no spec
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the special folders form a closed list: \`__setup__/\` (the TypeScript that prepares specs), \`__seeds__/\`, \`__requests__/\`, \`__expected__/\`, \`__fixtures__/\` (the ground); at the specs root, they hold what the specifications share, as a folder's hold what its leaves share.
                fix: rename it \`__seeds__/\`, and the paths that name it
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/cli/orders/shared/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`shared/\`, a folder of what several specifications share, and no subject: it holds no spec
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the special folders form a closed list: \`__setup__/\` (the TypeScript that prepares specs), \`__seeds__/\`, \`__requests__/\`, \`__expected__/\`, \`__fixtures__/\` (the ground); at the specs root, they hold what the specifications share, as a folder's hold what its leaves share.
                fix: move what it holds into the special folders of \`specs/cli/orders/\` itself: what the leaves of a folder share sits in that folder's \`__setup__/\` or ground, \`specs/__setup__/\` and the ground at the specs root for what specifications share
                read: docs/reference/linting.md#reserved-folder-in-closed-list
            specs/shared/:1:1  jterrazz-check(reserved-folder-in-closed-list)
                found: \`shared/\`, a folder of what several specifications share, and no subject: it holds no spec
                why: A folder under a specs tree whose name starts with \`_\` is never a subject, and the special folders form a closed list: \`__setup__/\` (the TypeScript that prepares specs), \`__seeds__/\`, \`__requests__/\`, \`__expected__/\`, \`__fixtures__/\` (the ground); at the specs root, they hold what the specifications share, as a folder's hold what its leaves share.
                fix: move what it holds into the special folders of \`specs/\` itself: what the leaves of a folder share sits in that folder's \`__setup__/\` or ground, \`specs/__setup__/\` and the ground at the specs root for what specifications share
                read: docs/reference/linting.md#reserved-folder-in-closed-list
        `);
    });
});
