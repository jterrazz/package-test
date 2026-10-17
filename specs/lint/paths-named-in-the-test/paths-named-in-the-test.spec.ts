import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('paths-named-in-the-test', () => {
    test('a helper that takes the file as a parameter passes, and the spec names it on its own line', async () => {
        // Given - the takes tree
        const result = await lint.fixture(directory('./__fixtures__/takes/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a helper, a stub or a specification building a file is refused where it builds it', async () => {
        // Given - the builds tree
        const result = await lint.fixture(directory('./__fixtures__/builds/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/api.specification.ts:4:25  jterrazz(paths-named-in-the-test)
                found: \`file()\` called outside a test
                why: \`file()\` and \`directory()\` are called in a test or spec file (a \`.test.ts(x)\`, a \`.spec.ts\`, a type test) and nowhere else: a shared helper module, a specification file or a stub takes a \`file()\` as a parameter and never builds one.
                fix: take the \`file()\` as a parameter, and build it in the test that stands on it
                read: docs/reference/linting.md#paths-named-in-the-test
            specs/api/orders/__setup__/stubs/http/stock.ts:1:1  jterrazz(stubs-root-holds-facades-and-kinds)
                found: the stub unit "stock.ts" has no default export
                why: Under \`specs/**/__setup__/stubs/\`: the ROOT carries only \`*.stubs.ts\` facades and one folder per stub KIND, a kind being a stub builder \`@jterrazz/test/stubs\` exports (\`http\` | \`openai\` | \`anthropic\`, the closed list its exports decide).
                fix: default-export \`defineStub(...)\`, or a factory returning one
                read: docs/reference/linting.md#stubs-root-holds-facades-and-kinds
            specs/api/orders/__setup__/stubs/http/stock.ts:4:12  jterrazz(paths-named-in-the-test)
                found: \`file()\` called outside a test
                why: \`file()\` and \`directory()\` are called in a test or spec file (a \`.test.ts(x)\`, a \`.spec.ts\`, a type test) and nowhere else: a shared helper module, a specification file or a stub takes a \`file()\` as a parameter and never builds one.
                fix: take the \`file()\` as a parameter, and build it in the test that stands on it
                read: docs/reference/linting.md#paths-named-in-the-test
            specs/api/orders/seeded.ts:5:21  jterrazz(paths-named-in-the-test)
                found: \`file()\` called outside a test
                why: \`file()\` and \`directory()\` are called in a test or spec file (a \`.test.ts(x)\`, a \`.spec.ts\`, a type test) and nowhere else: a shared helper module, a specification file or a stub takes a \`file()\` as a parameter and never builds one.
                fix: take the \`file()\` as a parameter, and build it in the test that stands on it
                read: docs/reference/linting.md#paths-named-in-the-test
        `);
    });
});
