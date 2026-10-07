import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('one-subject-per-spec', () => {
    test('--fix splits a file of two routes; the seed one route reads moves beside it, a module test following', async () => {
        // Given - the split tree
        const result = await checker.fixture(directory('./__fixtures__/split/')).run({ fix: true });

        // Then - nothing is left to report, and the fixed tree is its golden
        expect(result.report).toMatch('');
        await expect(result.directory()).toMatch(directory('./__expected__/split/'));
    });

    test('--fix moves a helper two of the split files read into the __setup__/ of the folder they share', async () => {
        // Given - the shared-helper tree
        const result = await checker
            .fixture(directory('./__fixtures__/shared-helper/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/api/orders/orders.spec.ts').exists).toBe(false);
        expect(result.file('specs/api/orders/__setup__/orders.ts').content).toBe(
            [
                "export const ITEM = 'book';",
                '',
                '/** An order of the one item the catalogue sells. */',
                'export function order(): { item: string } {',
                '    return { item: ITEM };',
                '}',
                '',
            ].join('\n'),
        );
        expect(result.file('specs/api/orders/create/orders.spec.ts').content).toContain(
            "import { order } from '../__setup__/orders.js';",
        );
        expect(result.file('specs/api/orders/update/orders.spec.ts').content).toContain(
            "import { order } from '../__setup__/orders.js';",
        );
    });

    test('a spec whose chains reach two routes is refused at the chain that reaches the second', async () => {
        // Given - the two-routes tree
        const result = await checker.fixture(directory('./__fixtures__/two-routes/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/orders.spec.ts:19:30  jterrazz-check(one-subject-per-spec)
                found: a spec reaching 2 subjects — GET /orders, POST /orders
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it, one file per subject — api/orders/list/orders.spec.ts, api/orders/create/orders.spec.ts — \`typescript fix\` splits it
                read: docs/reference/linting.md#one-subject-per-spec
        `);
    });

    test('a cli spec whose chains run two commands names each by its words', async () => {
        // Given - the two-commands tree, a runner whose `commands` list holds `db migrate` and `db seed`
        const result = await checker.fixture(directory('./__fixtures__/two-commands/')).run();

        // Then - the finding names both commands, every word of each
        expect(result.report).toMatch(`
            specs/cli/db/db.spec.ts:16:30  jterrazz-check(one-subject-per-spec)
                found: a spec reaching 2 subjects — exec db migrate, exec db seed
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it, one file per subject — cli/db/migrate/db.spec.ts, cli/db/seed/db.spec.ts — \`typescript fix\` splits it
                read: docs/reference/linting.md#one-subject-per-spec
        `);
    });

    test('--fix refuses a split whose subjects derive one folder, and leaves every test where it was — the console posts spec it once cut to 2 of 19 tests', async () => {
        // Given - create, list, read, replace and delete of one collection under /api, every one derived to api/posts
        const result = await checker
            .fixture(directory('./__fixtures__/shared-folder/'))
            .run({ fix: true });

        // Then - every test still in the file, none written to the folder they share, and the finding says why the fixer left it
        const kept = result.file('specs/api/posts/posts.spec.ts').content;
        expect({
            kept: ['creates', 'lists', 'reads', 'replaces', 'deletes'].map((verb) =>
                kept.includes(`test('${verb} `),
            ),
            written: result.file('specs/api/api/posts/posts.spec.ts').exists,
        }).toStrictEqual({ kept: [true, true, true, true, true], written: false });
        expect(result.report).toMatch(`
            specs/api/posts/posts.spec.ts:19:30  jterrazz-check(one-subject-per-spec)
                found: a spec reaching 5 subjects — POST /api/posts, GET /api/posts, GET /api/posts/:id, PUT /api/posts/:id, DELETE /api/posts/:id
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it by hand, one file per subject — \`typescript fix\` refuses: POST /api/posts and GET /api/posts are both filed at api/api/posts/posts.spec.ts: the split cannot tell them apart
                read: docs/reference/linting.md#one-subject-per-spec
        `);
    });

    test('--fix refuses a split whose tests stand in a loop: the cut would leave the loop emptied behind it', async () => {
        // Given - a registry spec listing the rules, and reading each legacy slug in a loop
        const result = await checker
            .fixture(directory('./__fixtures__/generated-tests/'))
            .run({ fix: true });

        // Then - the loop still holds its test in the file, nothing written to a route folder, and the finding names the generated test
        expect({
            kept: result
                .file('specs/api/redirects/registry.spec.ts')
                .content.includes('    for (const slug of LEGACY_ARTICLE_SLUGS) {\n        test('),
            written: result.file('specs/api/articles/get/registry.spec.ts').exists,
        }).toStrictEqual({ kept: true, written: false });
        expect(result.report).toMatch(`
            specs/api/redirects/registry.spec.ts:19:34  jterrazz-check(one-subject-per-spec)
                found: a spec reaching 2 subjects — GET /redirects, GET /articles/:id
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it by hand, one file per subject — \`typescript fix\` refuses: the test "moves \${slug} for good" stands inside a loop or a block that is no \`describe\`: a cut cannot tell how many tests it moves, nor leave the block whole
                read: docs/reference/linting.md#one-subject-per-spec
        `);
    });

    test('--fix says a loose comment once, in the file it opens on, and imports a moved helper as the spec writes its own imports', async () => {
        // Given - a header above the imports, a runner imported bare, a constant both routes read
        const result = await checker
            .fixture(directory('./__fixtures__/loose-comment/'))
            .run({ fix: true });

        // Then - nothing is left to report, and the fixed tree is its golden
        expect(result.report).toMatch('');
        await expect(result.directory()).toMatch(directory('./__expected__/loose-comment/'));
    });
});
