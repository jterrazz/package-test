import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('one-subject-per-spec', () => {
    test('--fix leaves a file of two routes whole, and reports the plan of its split: the folders and the tests each route takes', async () => {
        // Given - the split tree
        const result = await checker.fixture(directory('./__fixtures__/split/')).run({ fix: true });

        // Then - the finding stands with the plan, and the tree is the one it was given
        expect(result.report).toMatch(`
            specs/api/orders/orders.spec.ts:19:30  jterrazz-check(one-subject-per-spec)
                found: a spec reaching 2 subjects: GET /orders, POST /orders
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it by hand, one file per subject, each file named by you; GET /orders → api/orders/list/ ("lists the orders"); POST /orders → api/orders/create/ ("creates an order")
                read: docs/reference/linting.md#one-subject-per-spec
        `);
        expect(result.file('specs/api/orders/orders.spec.ts').exists).toBe(true);
    });

    test('a spec whose chains reach two routes is refused at the chain that reaches the second', async () => {
        // Given - the two-routes tree
        const result = await checker.fixture(directory('./__fixtures__/two-routes/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/orders.spec.ts:19:30  jterrazz-check(one-subject-per-spec)
                found: a spec reaching 2 subjects: GET /orders, POST /orders
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it by hand, one file per subject, each file named by you; GET /orders → api/orders/list/ ("lists the orders"); POST /orders → api/orders/create/ ("creates an order")
                read: docs/reference/linting.md#one-subject-per-spec
        `);
    });

    test('a mobile test opening the app again proves what the first open left, and only two tests opening two journeys reach two subjects', async () => {
        // Given - the mobile-relaunch tree: a bookmark journey relaunching into the library, and a feed spec whose two tests open two journeys
        const result = await checker.fixture(directory('./__fixtures__/mobile-relaunch/')).run();

        // Then - only the feed spec is reported
        expect(result.report).toMatch(`
            specs/mobile/events/feed.spec.ts:14:30  jterrazz-check(one-subject-per-spec)
                found: a spec reaching 2 subjects: open acme://events, open acme://dossier/42
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it by hand, one file per subject, each file named by you; beware: open acme://dossier/42 has no standard folder: the file it goes to is its author's to name
                read: docs/reference/linting.md#one-subject-per-spec
        `);
    });

    test('a cli spec whose chains run two commands names each by its words', async () => {
        // Given - the two-commands tree, a runner whose `commands` list holds `db migrate` and `db seed`
        const result = await checker.fixture(directory('./__fixtures__/two-commands/')).run();

        // Then - the finding names both commands, every word of each
        expect(result.report).toMatch(`
            specs/cli/db/db.spec.ts:16:30  jterrazz-check(one-subject-per-spec)
                found: a spec reaching 2 subjects: exec db migrate, exec db seed
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it by hand, one file per subject, each file named by you; exec db migrate → cli/db/migrate/ ("migrates the database"); exec db seed → cli/db/seed/ ("seeds the database")
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
                found: a spec reaching 5 subjects: POST /api/posts, GET /api/posts, GET /api/posts/:id, PUT /api/posts/:id, DELETE /api/posts/:id
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it by hand, one file per subject, each file named by you; POST /api/posts → api/api/posts/ ("creates a post and points at it"); GET /api/posts → api/api/posts/ ("lists the collection newest first"); GET /api/posts/:id → api/api/posts/ ("reads one post by id"); PUT /api/posts/:id → api/api/posts/ ("replaces a post whole"); DELETE /api/posts/:id → api/api/posts/ ("deletes a post"); beware: POST /api/posts and GET /api/posts are both filed at api/api/posts/posts.spec.ts: the split cannot tell them apart
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
                found: a spec reaching 2 subjects: GET /redirects, GET /articles/:id
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it by hand, one file per subject, each file named by you; GET /redirects → api/redirects/list/ ("lists every rule"); GET /articles/:id → api/articles/get/ ("moves \${slug} for good"); beware: the test "moves \${slug} for good" stands inside a loop or a block that is no \`describe\`: a cut cannot tell how many tests it moves, nor leave the block whole
                read: docs/reference/linting.md#one-subject-per-spec
        `);
    });
});
