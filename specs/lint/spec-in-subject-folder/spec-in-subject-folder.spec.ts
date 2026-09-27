import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('spec-in-subject-folder', () => {
    test('a spec of GET /orders filed under orders/list/ passes', async () => {
        // Given - the filed tree
        const result = await checker.fixture(directory('./_fixtures/filed/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('--fix files a command under every leading word its runner declares', async () => {
        // Given - the declared-commands tree
        const result = await checker
            .fixture(directory('./_fixtures/declared-commands/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/cli/db/migrating.spec.ts').exists).toBe(false);
        expect(result.file('specs/cli/db/migrate/migrating.spec.ts').content).toContain(
            "import { cli } from '../../cli.specification.js';",
        );
    });

    test('--fix lists a collection jterrazz.config.ts declares, where no plural names it', async () => {
        // Given - the declared-collection tree
        const result = await checker
            .fixture(directory('./_fixtures/declared-collection/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/api/data/get/listing.spec.ts').exists).toBe(false);
        expect(result.file('specs/api/data/list/listing.spec.ts').content).toContain(
            "import { api } from '../../api.specification.js';",
        );
    });

    test("--fix moves the spec to its subject's folder, and the ground it stands on with it", async () => {
        // Given - the moved tree
        const result = await checker.fixture(directory('./_fixtures/moved/')).run({ fix: true });

        // Then - nothing is left to report, and the fixed tree is its golden
        expect(result.report).toMatch('');
        await expect(result.directory()).toMatch(directory('./_expected/moved/'));
    });

    test('a spec of GET /orders filed anywhere but orders/list/ is refused at its first line', async () => {
        // Given - the misfiled tree
        const result = await checker.fixture(directory('./_fixtures/misfiled/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/listing.spec.ts:1:1  jterrazz-check(spec-in-subject-folder)
                found: a spec of GET /orders, filed under api/orders/
                why: A spec file about one subject sits in the subject’s standard folder, derived and never listed: \`GET /events\` → \`events/list/\`, \`GET /events/:id\` → \`events/get/\`, \`POST /events\` → \`events/create/\`, \`PUT|PATCH /events/:id\` → \`events/update/\`, \`DELETE /events/:id\` → \`events/delete/\`, a route under an item (\`GET /events/:id/timeline\`) its literal segments (\`events/timeline/\`), a singleton (\`GET /health\`) \`health/get/\`, a method-less route — one \`jterrazz.config.ts\` names so (\`test: { methodless: ['/mcp'] }\`), reached by whatever verb a test sends, and never split by it (\`one-subject-per-spec\`) — its segments (\`mcp/\`); a job its name (\`specs/job/<job>/\`), a cli command its first word (\`specs/cli/<word>/\`), or every leading word the \`commands\` list of the runner its chain's handle came from holds (\`specification.cli(bin, { commands: ['db', 'migrate'] })\` files \`db migrate\` under \`db/migrate/\`; the list written in the call or bound to a \`const\` of the runner's file).
                fix: move it to api/orders/list/listing.spec.ts — \`make fix\` moves it, and the ground it stands on
                read: docs/19-linting.md#spec-in-subject-folder
        `);
    });
});
