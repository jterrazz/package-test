import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('no-test-code-in-production', () => {
    test('production code importing production code passes', async () => {
        // Given - the product tree
        const result = await lint.fixture(directory('./_fixtures/product/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('production code importing what a test stands on is refused, from each of the four ground folders', async () => {
        // Given - the ground tree
        const result = await lint.fixture(directory('./_fixtures/ground/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/report/report.ts:1:20  jterrazz(no-test-code-in-production)
                found: production code references "./_expected/sample.json", ground (_expected/sample.json)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/19-linting.md#no-test-code-in-production
            src/report/report.ts:2:22  jterrazz(no-test-code-in-production)
                found: production code references "./_fixtures/rows.js", ground (_fixtures/rows.ts)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/19-linting.md#no-test-code-in-production
            src/report/report.ts:3:21  jterrazz(no-test-code-in-production)
                found: production code references "./_requests/report.http?raw", ground (_requests/report.http?raw)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/19-linting.md#no-test-code-in-production
            src/report/report.ts:4:18  jterrazz(no-test-code-in-production)
                found: production code references "./_seeds/rows.sql?raw", ground (_seeds/rows.sql?raw)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/19-linting.md#no-test-code-in-production
        `);
    });

    test('production code importing vitest is refused', async () => {
        // Given - the vitest-import tree
        const result = await lint.fixture(directory('./_fixtures/vitest-import/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/service.ts:1:24  jterrazz(no-test-code-in-production)
                found: production code references "vitest", a test package (vitest)
                why: A production module never reaches test material.
                fix: move the reference into a test — specs, \`*.test.ts\`, \`*.fixtures.ts\` or \`*.specification.ts\` — or move what production needs out of the test material
                read: docs/19-linting.md#no-test-code-in-production
        `);
    });
});
