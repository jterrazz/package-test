import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('test-beside-its-module', () => {
    test('a checkout under a folder named __tests__ is no stray test root, and its module test passes', async () => {
        // Given - the under-a-tests-root tree
        const result = await lint.fixture(directory('./_fixtures/under-a-tests-root/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a module test beside the module it covers passes', async () => {
        // Given - the sibling tree
        const result = await lint.fixture(directory('./_fixtures/sibling/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a module test with no neighbour module is refused', async () => {
        // Given - the orphan tree
        const result = await lint.fixture(directory('./_fixtures/orphan/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/util.test.ts:1:1  jterrazz(test-beside-its-module)
                found: a module test with no neighbour "util.ts"
                why: The test of \`<file>.ts\` is \`<file>.test.ts\` beside it; a misnamed \`.test.ts\`, a \`__tests__/\` directory or a package's \`tests/\` or \`test/\` root is an error.
                fix: move it next to the module it tests; a test needing more than its module is a spec — move it under \`specs/\` as a \`.spec.ts\`
                read: docs/reference/linting.md#test-beside-its-module
        `);
    });
});
