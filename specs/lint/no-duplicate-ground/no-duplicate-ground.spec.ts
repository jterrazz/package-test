import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-duplicate-ground', () => {
    test('two leaves holding a seed of one name with other bytes pass', async () => {
        // Given - the apart tree
        const result = await checker.fixture(directory('./__fixtures__/apart/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test("--fix moves one copy to the __seeds__/ its leaves share, and every path to either, a module test's too", async () => {
        // Given - the copied tree
        const result = await checker
            .fixture(directory('./__fixtures__/copied/'))
            .run({ fix: true });

        // Then - nothing is left to report, and the fixed tree is its golden
        expect(result.report).toMatch('');
        await expect(result.directory()).toMatch(directory('./__expected__/copied/'));
    });

    test('--fix rewrites a path written after a template literal with a hole', async () => {
        // Given - the after-a-template tree
        const result = await checker
            .fixture(directory('./__fixtures__/after-a-template/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/api/__seeds__/two-users.sql').exists).toBe(true);
        expect(result.file('specs/api/orders/orders.spec.ts').content).toContain(
            "file('../__seeds__/two-users.sql')",
        );
    });

    test('--fix deletes the copies of a seed their shared folder already holds, and names that one', async () => {
        // Given - the pooled tree
        const result = await checker
            .fixture(directory('./__fixtures__/pooled/'))
            .run({ fix: true });

        // Then - nothing is left to report, and the fixed tree is its golden
        expect(result.report).toMatch('');
        await expect(result.directory()).toMatch(directory('./__expected__/pooled/'));
    });

    test("--fix moves nothing when the copies' names disagree, since no name is the one to keep", async () => {
        // Given - the renamed tree
        const result = await checker
            .fixture(directory('./__fixtures__/renamed/'))
            .run({ fix: true });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/__seeds__/two-users.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as api/users/__seeds__/pair.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground (a file, or a tree compared file by file) that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/__seeds__/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/__seeds__/<name>\` across specifications), named by the path that climbs to it.
                fix: give the copies the one name the entry should keep: they go by several, so \`typescript fix\` moves none
                read: docs/reference/linting.md#no-duplicate-ground
            specs/api/users/__seeds__/pair.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as api/orders/__seeds__/two-users.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground (a file, or a tree compared file by file) that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/__seeds__/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/__seeds__/<name>\` across specifications), named by the path that climbs to it.
                fix: give the copies the one name the entry should keep: they go by several, so \`typescript fix\` moves none
                read: docs/reference/linting.md#no-duplicate-ground
        `);
        expect(result.file('specs/api/orders/__seeds__/two-users.sql').exists).toBe(true);
        expect(result.file('specs/api/users/__seeds__/pair.sql').exists).toBe(true);
        expect(result.file('specs/_shared/seeds').exists).toBe(false);
    });

    test("--fix moves nothing when the lowest folder of their leaves holds another file of the copies' name", async () => {
        // Given - the taken tree
        const result = await checker.fixture(directory('./__fixtures__/taken/')).run({ fix: true });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/__seeds__/two-users.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as api/users/__seeds__/two-users.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground (a file, or a tree compared file by file) that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/__seeds__/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/__seeds__/<name>\` across specifications), named by the path that climbs to it.
                fix: keep one copy in api/__seeds__/two-users.sql, which holds another two-users.sql, so rename one of the two first
                read: docs/reference/linting.md#no-duplicate-ground
            specs/api/users/__seeds__/two-users.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as api/orders/__seeds__/two-users.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground (a file, or a tree compared file by file) that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/__seeds__/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/__seeds__/<name>\` across specifications), named by the path that climbs to it.
                fix: keep one copy in api/__seeds__/two-users.sql, which holds another two-users.sql, so rename one of the two first
                read: docs/reference/linting.md#no-duplicate-ground
        `);
        expect(result.file('specs/api/users/__seeds__/two-users.sql').exists).toBe(true);
        expect(result.file('specs/api/orders/__seeds__/two-users.sql').exists).toBe(true);
        expect(result.file('specs/api/__seeds__/two-users.sql').content).toContain('Carol');
    });

    test('a seed two leaves hold byte for byte is refused on each copy', async () => {
        // Given - the copied tree
        const result = await checker.fixture(directory('./__fixtures__/copied/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/__seeds__/two-users.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as api/users/__seeds__/two-users.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground (a file, or a tree compared file by file) that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/__seeds__/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/__seeds__/<name>\` across specifications), named by the path that climbs to it.
                fix: keep one copy in api/__seeds__/two-users.sql; \`typescript fix\` moves it there and rewrites every whole relative path that named a copy
                read: docs/reference/linting.md#no-duplicate-ground
            specs/api/users/__seeds__/two-users.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as api/orders/__seeds__/two-users.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground (a file, or a tree compared file by file) that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/__seeds__/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/__seeds__/<name>\` across specifications), named by the path that climbs to it.
                fix: keep one copy in api/__seeds__/two-users.sql; \`typescript fix\` moves it there and rewrites every whole relative path that named a copy
                read: docs/reference/linting.md#no-duplicate-ground
        `);
    });

    test('a seed two leaves hold byte for byte under two names is refused on each copy', async () => {
        // Given - the renamed tree
        const result = await checker.fixture(directory('./__fixtures__/renamed/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/__seeds__/two-users.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as api/users/__seeds__/pair.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground (a file, or a tree compared file by file) that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/__seeds__/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/__seeds__/<name>\` across specifications), named by the path that climbs to it.
                fix: give the copies the one name the entry should keep: they go by several, so \`typescript fix\` moves none
                read: docs/reference/linting.md#no-duplicate-ground
            specs/api/users/__seeds__/pair.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as api/orders/__seeds__/two-users.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground (a file, or a tree compared file by file) that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/__seeds__/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/__seeds__/<name>\` across specifications), named by the path that climbs to it.
                fix: give the copies the one name the entry should keep: they go by several, so \`typescript fix\` moves none
                read: docs/reference/linting.md#no-duplicate-ground
        `);
    });
});
