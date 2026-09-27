import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('fix-writes', () => {
    test('--fix inlines a golden of blank lines as the value in place, not a quoted escape of it', async () => {
        // Given - the blank-golden tree
        const result = await checker
            .fixture(directory('./_fixtures/blank-golden/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/widget/expected').exists).toBe(false);
        expect(result.file('specs/widget/widget.test.ts').content).toBe(
            [
                "import { text } from '@jterrazz/test';",
                "import { describe, expect, test } from 'vitest';",
                '',
                "describe('widget', () => {",
                "test('a blank golden', () => {",
                "    expect(text('\\n\\n\\n')).toMatch(`",
                '',
                '',
                '',
                '    `);',
                '});',
                '});',
                '',
            ].join('\n'),
        );
    });

    test('--fix writes each single-use golden, body and request in place, and leaves a seed a file', async () => {
        // Given - the single-use tree
        const result = await checker
            .fixture(directory('./_fixtures/single-use/'))
            .run({ fix: true });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/users/created.spec.ts:41:37  jterrazz-check(ground-shared-or-inline)
                found: api/users/_expected/twice.http, read by this test alone
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write it here, the value \`toMatch\` compares, and delete the file — \`make fix\` inlines it
                read: docs/19-linting.md#ground-shared-or-inline
        `);
        await expect(result.directory()).toMatch(directory('./_expected/single-use/'));
    });

    test('--fix writes a value past its cap to a file named from its test, and names it with file()', async () => {
        // Given - the past-cap tree
        const result = await checker.fixture(directory('./_fixtures/past-cap/')).run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/api/users/_requests/creates-a-crowd.json').content).toContain(
            '"role 25"',
        );
        expect(result.file('specs/api/users/_expected/lists-everyone.http').content).toContain(
            'content-type: text/plain\n\nuser 0\n',
        );
        expect(result.file('specs/api/users/created.spec.ts').content).toContain(
            "api.post('/users', file('./_requests/creates-a-crowd.json'))",
        );
    });

    test('--fix writes each SQL to a seed beside its spec, named by its comment or four words of its test', async () => {
        // Given - the inline-sql tree
        const result = await checker
            .fixture(directory('./_fixtures/inline-sql/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/api/users/_seeds/two-users-one-admin.sql').content).toBe(
            [
                '-- Two users, one admin',
                "INSERT INTO users (name, admin) VALUES ('Ada', true), ('Grace', false);",
                '',
            ].join('\n'),
        );
        expect(result.file('specs/api/users/_seeds/lists-users.sql').content).toBe(
            ["INSERT INTO users (name) VALUES ('Linus');", ''].join('\n'),
        );
        expect(result.file('specs/api/users/_seeds/lists-users-2.sql').content).toBe(
            "INSERT INTO users (name) VALUES ('Joan');",
        );
        expect(result.file('specs/api/users/listed.spec.ts').content).toBe(
            [
                "import { file } from '@jterrazz/test'; // checker-disable-line spec-in-subject-folder -- an input of ground-shared-or-inline: this folder is the case the rule reads, not a subject's standard name",
                "import { describe, expect, test } from 'vitest';",
                '',
                "import { api } from '../api.specification.js';",
                '',
                "describe('listed', () => {",
                "test('lists the users', async () => {",
                "    // Given - two users, the first named by its comment, the second by this test's title, its filler dropped — a name another seed holds",
                '    const result = await api',
                "        .seed(file('./_seeds/two-users-one-admin.sql'))",
                "        .seed(file('./_seeds/lists-users-2.sql'))",
                "        .get('/users');",
                '',
                '    // Then - the users',
                "    expect(result.response).toMatch('HTTP/1.1 200 OK');",
                '});',
                '',
                "test('lists the user its seed file holds', async () => {",
                '    // Given - one user, from the seed this test alone reads',
                "    const result = await api.seed(file('./_seeds/lists-users.sql')).get('/users');",
                '',
                '    // Then - the user',
                "    expect(result.response).toMatch('HTTP/1.1 200 OK');",
                '});',
                '});',
                '',
            ].join('\n'),
        );
    });

    test("--fix names the seed and the golden that already hold a value's bytes, and writes no -2 file", async () => {
        // Given - the same-bytes tree
        const result = await checker
            .fixture(directory('./_fixtures/same-bytes/'))
            .run({ fix: true });

        // Then - nothing is left to report, and the fixed tree is its golden
        expect(result.report).toMatch('');
        await expect(result.directory()).toMatch(directory('./_expected/same-bytes/'));
    });
});
