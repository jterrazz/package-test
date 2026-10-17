import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('refusals', () => {
    test('a golden of blank lines alone is refused where its one test reads it, like any other single-use file', async () => {
        // Given - the blank-golden tree
        const result = await checker.fixture(directory('./__fixtures__/blank-golden/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/widget.test.ts:6:36  jterrazz-check(ground-shared-or-inline)
                found: widget/__expected__/blank.txt, read by this test alone
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write it here, the value \`toMatch\` compares, and delete the file; \`typescript fix\` inlines it
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a JSON golden opening on an indented line break is refused like any other, its value being what is written', async () => {
        // Given - the indented-json tree
        const result = await checker.fixture(directory('./__fixtures__/indented-json/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/widget.test.ts:6:32  jterrazz-check(ground-shared-or-inline)
                found: widget/__expected__/state.json, read by this test alone
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write it here, the value \`toMatch\` compares, and delete the file; \`typescript fix\` inlines it
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a seed of the specs root only one leaf reaches for, from two tests, is refused where it sits', async () => {
        // Given - the lonely-seed tree
        const result = await checker.fixture(directory('./__fixtures__/lonely-seed/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/__seeds__/one-user.sql:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only api/users reaches for, kept above it
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to api/users/__seeds__/one-user.sql and name it file('./__seeds__/one-user.sql'); \`typescript fix\` does both
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a pool seed only a route and its sub-route reach for is refused where it sits', async () => {
        // Given - the nested-route tree
        const result = await checker.fixture(directory('./__fixtures__/nested-route/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/__seeds__/single-base.sql:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only the leaves under api/map/pois reach for, kept above them
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to api/map/pois/__seeds__/single-base.sql, the ground of the lowest folder its readers share, and name it from each leaf by the path that climbs to it; \`typescript fix\` does both
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a pool seed two sibling routes of one specification reach for is refused where it sits', async () => {
        // Given - the sibling-routes tree
        const result = await checker.fixture(directory('./__fixtures__/sibling-routes/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/__seeds__/two-pois.sql:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only the leaves under api/map reach for, kept above them
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to api/map/__seeds__/two-pois.sql, the ground of the lowest folder its readers share, and name it from each leaf by the path that climbs to it; \`typescript fix\` does both
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test("a pool fixture one specification's runner alone reads is refused where it sits", async () => {
        // Given - the runner-read tree
        const result = await checker.fixture(directory('./__fixtures__/runner-read/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/__fixtures__/shop:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only cli reaches for, kept above it
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to cli/__fixtures__/shop and name it directory('./__fixtures__/shop/'); \`typescript fix\` does both
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a golden, a body and a request one test reads are refused where named, and a seed is not', async () => {
        // Given - the single-use tree
        const result = await checker.fixture(directory('./__fixtures__/single-use/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/users/created.spec.ts:9:79  jterrazz-check(ground-shared-or-inline)
                found: api/users/__requests__/grace.json, read by this test alone
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write it here, the request or its body, and delete the file; \`typescript fix\` inlines it
                read: docs/reference/linting.md#ground-shared-or-inline
            specs/api/users/created.spec.ts:12:37  jterrazz-check(ground-shared-or-inline)
                found: api/users/__expected__/created.http, read by this test alone
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write it here, the value \`toMatch\` compares, and delete the file; \`typescript fix\` inlines it
                read: docs/reference/linting.md#ground-shared-or-inline
            specs/api/users/created.spec.ts:17:38  jterrazz-check(ground-shared-or-inline)
                found: api/users/__requests__/linus.http, read by this test alone
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write it here, the request or its body, and delete the file; \`typescript fix\` inlines it
                read: docs/reference/linting.md#ground-shared-or-inline
            specs/api/users/created.spec.ts:28:38  jterrazz-check(ground-shared-or-inline)
                found: api/users/__expected__/line.txt, read by this test alone
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write it here, the value \`toMatch\` compares, and delete the file; \`typescript fix\` inlines it
                read: docs/reference/linting.md#ground-shared-or-inline
            specs/api/users/created.spec.ts:29:37  jterrazz-check(ground-shared-or-inline)
                found: api/users/__expected__/twice.http, read by this test alone
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write it here, the value \`toMatch\` compares, and delete the file; \`typescript fix\` inlines it
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a string subject compared to a value past its cap is refused where written', async () => {
        // Given - the past-cap-string tree
        const result = await checker.fixture(directory('./__fixtures__/past-cap-string/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/widget.test.ts:6:29  jterrazz-check(ground-shared-or-inline)
                found: an expectation of 162 lines written in the test, past the __expected__/ cap of 150
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: a string has no golden: wrap it, \`expect(text(message)).toMatch(file('./__expected__/a-long-message.txt'))\`, or compare the result it came from to its file; by hand: the fixer never writes a string's comparison to a file
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a value past its cap the fixer cannot read — a name, a hole, a matcher — is refused', async () => {
        // Given - the past-cap-unreadable tree
        const result = await checker
            .fixture(directory('./__fixtures__/past-cap-unreadable/'))
            .run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/users/create/created.spec.ts:10:45  jterrazz-check(ground-shared-or-inline)
                found: a request of 31 lines written in the test, past the __requests__/ cap of 30
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to a file under ./__requests__/ and name it with file(), by hand, since the fixer reads a string, a template or a JSON value only
                read: docs/reference/linting.md#ground-shared-or-inline
            specs/api/users/create/created.spec.ts:48:38  jterrazz-check(ground-shared-or-inline)
                found: a request of 33 lines written in the test, past the __requests__/ cap of 30
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to a file under ./__requests__/ and name it with file(), by hand, since the fixer reads a string, a template or a JSON value only
                read: docs/reference/linting.md#ground-shared-or-inline
            specs/api/users/create/created.spec.ts:91:33  jterrazz-check(ground-shared-or-inline)
                found: an expectation of 156 lines written in the test, past the __expected__/ cap of 150
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to a file under ./__expected__/ and name it with file(), by hand, since the fixer reads a string, a template or a JSON value only
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a body past 30 lines and a response past 150 are refused where written, a 30-line body is not', async () => {
        // Given - the past-cap tree
        const result = await checker.fixture(directory('./__fixtures__/past-cap/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/users/created.spec.ts:8:45  jterrazz-check(ground-shared-or-inline)
                found: a request of 31 lines written in the test, past the __requests__/ cap of 30
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to ./__requests__/creates-a-crowd.json and name it with file('./__requests__/creates-a-crowd.json'); \`typescript fix\` moves it
                read: docs/reference/linting.md#ground-shared-or-inline
            specs/api/users/created.spec.ts:86:37  jterrazz-check(ground-shared-or-inline)
                found: an expectation of 151 lines written in the test, past the __expected__/ cap of 150
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to ./__expected__/lists-everyone.http and name it with file('./__expected__/lists-everyone.http'); \`typescript fix\` moves it
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a query written in a test is refused where its sql tag stands', async () => {
        // Given - the inline-sql tree
        const result = await checker.fixture(directory('./__fixtures__/inline-sql/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/users/listed.spec.ts:10:15  jterrazz-check(ground-shared-or-inline)
                found: SQL written in the test, tagged \`sql\`
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write the statements to ./__seeds__/two-users-one-admin.sql and seed it with file('./__seeds__/two-users-one-admin.sql'); \`typescript fix\` writes the file
                read: docs/reference/linting.md#ground-shared-or-inline
            specs/api/users/listed.spec.ts:14:15  jterrazz-check(ground-shared-or-inline)
                found: SQL written in the test, tagged \`sql\`
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write the statements to ./__seeds__/lists-users.sql and seed it with file('./__seeds__/lists-users.sql'); \`typescript fix\` writes the file
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a pool fixture only one spec directory reaches for is refused', async () => {
        // Given - the lonely tree
        const result = await checker.fixture(directory('./__fixtures__/lonely/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/__fixtures__/lonely-stub:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only widget reaches for, kept above it
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to widget/__fixtures__/lonely-stub and name it directory('./__fixtures__/lonely-stub/'); \`typescript fix\` does both
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });
});
