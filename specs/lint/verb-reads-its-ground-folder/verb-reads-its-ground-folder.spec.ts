import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('verb-reads-its-ground-folder', () => {
    test('a file bound to a const and handed to the verb whose folder it names passes', async () => {
        // Given - the bound-own tree
        const result = await lint.fixture(directory('./_fixtures/bound-own/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('each verb reading the ground folder named for it passes', async () => {
        // Given - the own tree
        const result = await lint.fixture(directory('./_fixtures/own/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a file bound to a const is followed to the verb it reaches, and refused where it is handed over', async () => {
        // Given - the bound tree
        const result = await lint.fixture(directory('./_fixtures/bound/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/orders.spec.ts:9:35  jterrazz(verb-reads-its-ground-folder)
                found: \`seed()\` reads _seeds/, and \`file('./_fixtures/rows.sql')\` names _fixtures/
                why: The verb and the ground folder agree: \`seed()\` reads \`_seeds/\`, \`request()\` and a request body (\`post\`/\`put\`) read \`_requests/\`, \`fixture()\` reads \`_fixtures/\`, a golden \`toMatch(file|directory(…))\` reads \`_expected/\`, and \`run()\` reads a document beside the test, under no ground folder — or under \`_fixtures/\` for a document that is an input a negative spec runs.
                fix: move the file to ./_seeds/ beside the test, or in the _seeds/ of the lowest folder the leaves share (specs/_shared/_seeds/ across facets), and name it from there
                read: docs/reference/linting.md#verb-reads-its-ground-folder
            specs/api/orders/orders.spec.ts:12:37  jterrazz(verb-reads-its-ground-folder)
                found: \`toMatch()\` reads _expected/, and \`file('./_requests/orders.http')\` names _requests/
                why: The verb and the ground folder agree: \`seed()\` reads \`_seeds/\`, \`request()\` and a request body (\`post\`/\`put\`) read \`_requests/\`, \`fixture()\` reads \`_fixtures/\`, a golden \`toMatch(file|directory(…))\` reads \`_expected/\`, and \`run()\` reads a document beside the test, under no ground folder — or under \`_fixtures/\` for a document that is an input a negative spec runs.
                fix: move the file to ./_expected/ beside the test, or in the _expected/ of the lowest folder the leaves share (specs/_shared/_expected/ across facets), and name it from there
                read: docs/reference/linting.md#verb-reads-its-ground-folder
        `);
    });

    test('a file handed to a verb that reads another ground folder is refused where it is named', async () => {
        // Given - the crossed tree
        const result = await lint.fixture(directory('./_fixtures/crossed/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/orders.spec.ts:7:40  jterrazz(verb-reads-its-ground-folder)
                found: \`seed()\` reads _seeds/, and \`file('./_fixtures/rows.sql')\` names _fixtures/
                why: The verb and the ground folder agree: \`seed()\` reads \`_seeds/\`, \`request()\` and a request body (\`post\`/\`put\`) read \`_requests/\`, \`fixture()\` reads \`_fixtures/\`, a golden \`toMatch(file|directory(…))\` reads \`_expected/\`, and \`run()\` reads a document beside the test, under no ground folder — or under \`_fixtures/\` for a document that is an input a negative spec runs.
                fix: move the file to ./_seeds/ beside the test, or in the _seeds/ of the lowest folder the leaves share (specs/_shared/_seeds/ across facets), and name it from there
                read: docs/reference/linting.md#verb-reads-its-ground-folder
            specs/api/orders/orders.spec.ts:10:42  jterrazz(verb-reads-its-ground-folder)
                found: \`toMatch()\` reads _expected/, and \`file('./_requests/orders.http')\` names _requests/
                why: The verb and the ground folder agree: \`seed()\` reads \`_seeds/\`, \`request()\` and a request body (\`post\`/\`put\`) read \`_requests/\`, \`fixture()\` reads \`_fixtures/\`, a golden \`toMatch(file|directory(…))\` reads \`_expected/\`, and \`run()\` reads a document beside the test, under no ground folder — or under \`_fixtures/\` for a document that is an input a negative spec runs.
                fix: move the file to ./_expected/ beside the test, or in the _expected/ of the lowest folder the leaves share (specs/_shared/_expected/ across facets), and name it from there
                read: docs/reference/linting.md#verb-reads-its-ground-folder
        `);
    });
});
