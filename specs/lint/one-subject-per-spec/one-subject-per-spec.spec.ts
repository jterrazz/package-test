import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('one-subject-per-spec', () => {
    test('--fix splits a file of two routes; the seed one route reads moves beside it, a module test following', async () => {
        // Given - the split tree
        const result = await checker.fixture(directory('./_fixtures/split/')).run({ fix: true });

        // Then - nothing is left to report, and the fixed tree is its golden
        expect(result.report).toMatch('');
        await expect(result.directory()).toMatch(directory('./_expected/split/'));
    });

    test('--fix moves a helper two of the split files read into the _setup/ of the folder they share', async () => {
        // Given - the shared-helper tree
        const result = await checker
            .fixture(directory('./_fixtures/shared-helper/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/api/orders/orders.spec.ts').exists).toBe(false);
        expect(result.file('specs/api/orders/_setup/orders.ts').content).toBe(
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
            "import { order } from '../_setup/orders.js';",
        );
        expect(result.file('specs/api/orders/update/orders.spec.ts').content).toContain(
            "import { order } from '../_setup/orders.js';",
        );
    });

    test('a spec whose chains reach two routes is refused at the chain that reaches the second', async () => {
        // Given - the two-routes tree
        const result = await checker.fixture(directory('./_fixtures/two-routes/')).run();

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
        const result = await checker.fixture(directory('./_fixtures/two-commands/')).run();

        // Then - the finding names both commands, every word of each
        expect(result.report).toMatch(`
            specs/cli/db/db.spec.ts:16:30  jterrazz-check(one-subject-per-spec)
                found: a spec reaching 2 subjects — exec db migrate, exec db seed
                why: Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (\`GET /events/:id\`, the request line of a \`.http\` a \`.request(file())\` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens.
                fix: split it, one file per subject — cli/db/migrate/db.spec.ts, cli/db/seed/db.spec.ts — \`typescript fix\` splits it
                read: docs/reference/linting.md#one-subject-per-spec
        `);
    });
});
