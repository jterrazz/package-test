import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('verb-reads-its-ground-folder', () => {
    test('a file bound to a const and handed to the verb whose folder it names passes', async () => {
        // Given - the bound-own tree
        const result = await lint.fixture(directory('./__fixtures__/bound-own/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('each verb reading the ground folder named for it passes', async () => {
        // Given - the own tree
        const result = await lint.fixture(directory('./__fixtures__/own/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a file bound to a const is followed to the verb it reaches, and refused where it is handed over', async () => {
        // Given - the bound tree
        const result = await lint.fixture(directory('./__fixtures__/bound/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/orders.spec.ts:9:35  jterrazz(verb-reads-its-ground-folder)
                found: \`seed()\` reads __seeds__/, and \`file('./__fixtures__/rows.sql')\` names __fixtures__/
                why: The verb and the ground folder agree: \`seed()\` reads \`__seeds__/\`, \`request()\` and a request body (\`post\`/\`put\`) read \`__requests__/\`, \`fixture()\` reads \`__fixtures__/\`, a golden \`toMatch(file|directory(...))\` reads \`__expected__/\`, and \`run()\` reads a document beside the test, under no ground folder, or under \`__fixtures__/\` for a document that is an input a negative spec runs.
                fix: move the file to ./__seeds__/ beside the test, or in the __seeds__/ of the lowest folder the leaves share (specs/__seeds__/ across specifications), and name it from there
                read: docs/reference/linting.md#verb-reads-its-ground-folder
            specs/api/orders/orders.spec.ts:12:37  jterrazz(verb-reads-its-ground-folder)
                found: \`toMatch()\` reads __expected__/, and \`file('./__requests__/orders.http')\` names __requests__/
                why: The verb and the ground folder agree: \`seed()\` reads \`__seeds__/\`, \`request()\` and a request body (\`post\`/\`put\`) read \`__requests__/\`, \`fixture()\` reads \`__fixtures__/\`, a golden \`toMatch(file|directory(...))\` reads \`__expected__/\`, and \`run()\` reads a document beside the test, under no ground folder, or under \`__fixtures__/\` for a document that is an input a negative spec runs.
                fix: move the file to ./__expected__/ beside the test, or in the __expected__/ of the lowest folder the leaves share (specs/__expected__/ across specifications), and name it from there
                read: docs/reference/linting.md#verb-reads-its-ground-folder
        `);
    });

    test('a file handed to a verb that reads another ground folder is refused where it is named', async () => {
        // Given - the crossed tree
        const result = await lint.fixture(directory('./__fixtures__/crossed/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/orders.spec.ts:7:40  jterrazz(verb-reads-its-ground-folder)
                found: \`seed()\` reads __seeds__/, and \`file('./__fixtures__/rows.sql')\` names __fixtures__/
                why: The verb and the ground folder agree: \`seed()\` reads \`__seeds__/\`, \`request()\` and a request body (\`post\`/\`put\`) read \`__requests__/\`, \`fixture()\` reads \`__fixtures__/\`, a golden \`toMatch(file|directory(...))\` reads \`__expected__/\`, and \`run()\` reads a document beside the test, under no ground folder, or under \`__fixtures__/\` for a document that is an input a negative spec runs.
                fix: move the file to ./__seeds__/ beside the test, or in the __seeds__/ of the lowest folder the leaves share (specs/__seeds__/ across specifications), and name it from there
                read: docs/reference/linting.md#verb-reads-its-ground-folder
            specs/api/orders/orders.spec.ts:10:42  jterrazz(verb-reads-its-ground-folder)
                found: \`toMatch()\` reads __expected__/, and \`file('./__requests__/orders.http')\` names __requests__/
                why: The verb and the ground folder agree: \`seed()\` reads \`__seeds__/\`, \`request()\` and a request body (\`post\`/\`put\`) read \`__requests__/\`, \`fixture()\` reads \`__fixtures__/\`, a golden \`toMatch(file|directory(...))\` reads \`__expected__/\`, and \`run()\` reads a document beside the test, under no ground folder, or under \`__fixtures__/\` for a document that is an input a negative spec runs.
                fix: move the file to ./__expected__/ beside the test, or in the __expected__/ of the lowest folder the leaves share (specs/__expected__/ across specifications), and name it from there
                read: docs/reference/linting.md#verb-reads-its-ground-folder
        `);
    });
});
