import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-test-code-in-production', () => {
    test('production code importing production code passes', async () => {
        // Given - the product tree
        const result = await lint.fixture(directory('./__fixtures__/product/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('production code importing what a test stands on is refused, from each of the four ground folders', async () => {
        // Given - the ground tree
        const result = await lint.fixture(directory('./__fixtures__/ground/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/report/report.ts:1:20  jterrazz(no-test-code-in-production)
                found: production code references "./__expected__/sample.json", ground (__expected__/sample.json)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/reference/linting.md#no-test-code-in-production
            src/report/report.ts:2:22  jterrazz(no-test-code-in-production)
                found: production code references "./__fixtures__/rows.js", ground (__fixtures__/rows.ts)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/reference/linting.md#no-test-code-in-production
            src/report/report.ts:3:21  jterrazz(no-test-code-in-production)
                found: production code references "./__requests__/report.http?raw", ground (__requests__/report.http?raw)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/reference/linting.md#no-test-code-in-production
            src/report/report.ts:4:18  jterrazz(no-test-code-in-production)
                found: production code references "./__seeds__/rows.sql?raw", ground (__seeds__/rows.sql?raw)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/reference/linting.md#no-test-code-in-production
        `);
    });

    test('production code importing vitest is refused', async () => {
        // Given - the vitest-import tree
        const result = await lint.fixture(directory('./__fixtures__/vitest-import/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/service.ts:1:24  jterrazz(no-test-code-in-production)
                found: production code references "vitest", a test package (vitest)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/reference/linting.md#no-test-code-in-production
        `);
    });

    test('an alias a tsconfig maps is resolved even when the base it extends does not resolve', async () => {
        // Given - a tsconfig extending a file that is not there, its own paths mapping `~/` to src/, and production code importing ground through the alias
        const result = await lint.fixture(directory('./__fixtures__/unresolved-base/')).run();

        // Then - the import is refused at its line, the missing base read as nothing
        expect(result.report).toMatch(`
            src/service.ts:1:23  jterrazz(no-test-code-in-production)
                found: production code references "~/__fixtures__/users.js", ground (__fixtures__/users.ts)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/reference/linting.md#no-test-code-in-production
        `);
    });
});
