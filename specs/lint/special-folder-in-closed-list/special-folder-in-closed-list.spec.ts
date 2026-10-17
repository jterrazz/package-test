import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as preset } from '../preset-lint.specification.js';

describe('special-folder-in-closed-list', () => {
    test('accepts a __setup__/ under a specification and __setup__/ at the root', async () => {
        // Given - the reserved tree
        const result = await preset.fixture(directory('./__fixtures__/reserved/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('refuses a _ name off the closed list, and leaves what a __setup__/ holds to the checker', async () => {
        // Given - the unlisted tree
        const result = await preset.fixture(directory('./__fixtures__/unlisted/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/_drafts/:1:1  names(special-folder-in-closed-list)
                found: \`specs/_drafts/\` breaks ls-lint's \`.dir: regex:(?:([^_].*)|(__setup__)|(__expected__)|(__fixtures__)|(__requests__)|(__seeds__))\`
                why: A folder under a specs tree whose name starts with \`_\` is one of the closed list of special folders (\`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`) and any other \`_\` name is an error at the folder, the closed list in its fix: an unknown \`__<word>__/\` (\`__mocks__/\`, \`__snapshots__/\`, \`__helpers__/\`, \`__tests__/\`), a subject that starts with \`_\`, and an earlier spelling (\`_setup/\`, \`_fixtures/\`, \`_expected/\`, \`_requests/\`, \`_seeds/\`, whose fix names its special folder, and \`_shared/\`, whose folders sit at the specs root now).
                fix: rename it to the special folder that says what it holds (\`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`), or drop the \`_\` if it is a subject; an earlier spelling names its own (\`_expected/\` is \`__expected__/\`, \`_fixtures/\` is \`__fixtures__/\`, \`_requests/\` is \`__requests__/\`, \`_seeds/\` is \`__seeds__/\`, \`_setup/\` is \`__setup__/\`), and what \`_shared/\` held sits in the special folders at the specs root
                read: docs/reference/linting.md#special-folder-in-closed-list
            specs/_shared/:1:1  names(special-folder-in-closed-list)
                found: \`specs/_shared/\` breaks ls-lint's \`.dir: regex:(?:([^_].*)|(__setup__)|(__expected__)|(__fixtures__)|(__requests__)|(__seeds__))\`
                why: A folder under a specs tree whose name starts with \`_\` is one of the closed list of special folders (\`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`) and any other \`_\` name is an error at the folder, the closed list in its fix: an unknown \`__<word>__/\` (\`__mocks__/\`, \`__snapshots__/\`, \`__helpers__/\`, \`__tests__/\`), a subject that starts with \`_\`, and an earlier spelling (\`_setup/\`, \`_fixtures/\`, \`_expected/\`, \`_requests/\`, \`_seeds/\`, whose fix names its special folder, and \`_shared/\`, whose folders sit at the specs root now).
                fix: rename it to the special folder that says what it holds (\`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`), or drop the \`_\` if it is a subject; an earlier spelling names its own (\`_expected/\` is \`__expected__/\`, \`_fixtures/\` is \`__fixtures__/\`, \`_requests/\` is \`__requests__/\`, \`_seeds/\` is \`__seeds__/\`, \`_setup/\` is \`__setup__/\`), and what \`_shared/\` held sits in the special folders at the specs root
                read: docs/reference/linting.md#special-folder-in-closed-list
            specs/cli/__mocks__/:1:1  names(special-folder-in-closed-list)
                found: \`specs/cli/__mocks__/\` breaks ls-lint's \`.dir: regex:(?:([^_].*)|(__setup__)|(__expected__)|(__fixtures__)|(__requests__)|(__seeds__))\`
                why: A folder under a specs tree whose name starts with \`_\` is one of the closed list of special folders (\`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`) and any other \`_\` name is an error at the folder, the closed list in its fix: an unknown \`__<word>__/\` (\`__mocks__/\`, \`__snapshots__/\`, \`__helpers__/\`, \`__tests__/\`), a subject that starts with \`_\`, and an earlier spelling (\`_setup/\`, \`_fixtures/\`, \`_expected/\`, \`_requests/\`, \`_seeds/\`, whose fix names its special folder, and \`_shared/\`, whose folders sit at the specs root now).
                fix: rename it to the special folder that says what it holds (\`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`), or drop the \`_\` if it is a subject; an earlier spelling names its own (\`_expected/\` is \`__expected__/\`, \`_fixtures/\` is \`__fixtures__/\`, \`_requests/\` is \`__requests__/\`, \`_seeds/\` is \`__seeds__/\`, \`_setup/\` is \`__setup__/\`), and what \`_shared/\` held sits in the special folders at the specs root
                read: docs/reference/linting.md#special-folder-in-closed-list
            specs/cli/orders/_archive/:1:1  names(special-folder-in-closed-list)
                found: \`specs/cli/orders/_archive/\` breaks ls-lint's \`.dir: regex:(?:([^_].*)|(__setup__)|(__expected__)|(__fixtures__)|(__requests__)|(__seeds__))\`
                why: A folder under a specs tree whose name starts with \`_\` is one of the closed list of special folders (\`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`) and any other \`_\` name is an error at the folder, the closed list in its fix: an unknown \`__<word>__/\` (\`__mocks__/\`, \`__snapshots__/\`, \`__helpers__/\`, \`__tests__/\`), a subject that starts with \`_\`, and an earlier spelling (\`_setup/\`, \`_fixtures/\`, \`_expected/\`, \`_requests/\`, \`_seeds/\`, whose fix names its special folder, and \`_shared/\`, whose folders sit at the specs root now).
                fix: rename it to the special folder that says what it holds (\`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`), or drop the \`_\` if it is a subject; an earlier spelling names its own (\`_expected/\` is \`__expected__/\`, \`_fixtures/\` is \`__fixtures__/\`, \`_requests/\` is \`__requests__/\`, \`_seeds/\` is \`__seeds__/\`, \`_setup/\` is \`__setup__/\`), and what \`_shared/\` held sits in the special folders at the specs root
                read: docs/reference/linting.md#special-folder-in-closed-list
            specs/cli/orders/_setup/:1:1  names(special-folder-in-closed-list)
                found: \`specs/cli/orders/_setup/\` breaks ls-lint's \`.dir: regex:(?:([^_].*)|(__setup__)|(__expected__)|(__fixtures__)|(__requests__)|(__seeds__))\`
                why: A folder under a specs tree whose name starts with \`_\` is one of the closed list of special folders (\`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`) and any other \`_\` name is an error at the folder, the closed list in its fix: an unknown \`__<word>__/\` (\`__mocks__/\`, \`__snapshots__/\`, \`__helpers__/\`, \`__tests__/\`), a subject that starts with \`_\`, and an earlier spelling (\`_setup/\`, \`_fixtures/\`, \`_expected/\`, \`_requests/\`, \`_seeds/\`, whose fix names its special folder, and \`_shared/\`, whose folders sit at the specs root now).
                fix: rename it to the special folder that says what it holds (\`__setup__/\`, \`__expected__/\`, \`__fixtures__/\`, \`__requests__/\`, \`__seeds__/\`), or drop the \`_\` if it is a subject; an earlier spelling names its own (\`_expected/\` is \`__expected__/\`, \`_fixtures/\` is \`__fixtures__/\`, \`_requests/\` is \`__requests__/\`, \`_seeds/\` is \`__seeds__/\`, \`_setup/\` is \`__setup__/\`), and what \`_shared/\` held sits in the special folders at the specs root
                read: docs/reference/linting.md#special-folder-in-closed-list
        `);
    });
});
