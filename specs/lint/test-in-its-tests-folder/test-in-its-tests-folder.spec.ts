import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('test-in-its-tests-folder', () => {
    test('a checkout under a folder named __tests__ is no stray test root, and its module test passes', async () => {
        // Given - the under-a-tests-root tree
        const result = await lint.fixture(directory('./__fixtures__/under-a-tests-root/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a module test in the __tests__ of its module’s folder passes', async () => {
        // Given - the sibling tree
        const result = await lint.fixture(directory('./__fixtures__/sibling/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a module test beside its module, and one naming no module, are refused', async () => {
        // Given - the orphan tree
        const result = await lint.fixture(directory('./__fixtures__/orphan/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/__tests__/util.test.ts:1:1  jterrazz(test-in-its-tests-folder)
                found: a module test naming no "util.ts" in the folder above its \`__tests__/\`
                why: The test of \`<dir>/<file>.ts\` is \`<dir>/__tests__/<file>.test.ts\` — the conventional folder of its module's folder, holding its tests, the typed data they read (\`<file>.fixtures.ts\`) and the ground they stand on.
                fix: name it for a module of that folder — \`__tests__/<file>.test.ts\` tests \`<file>.ts\`; a test needing more than its module is a spec — move it under \`specs/\` as a \`.spec.ts\`
                read: docs/reference/linting.md#test-in-its-tests-folder
            src/beside.test.ts:1:1  jterrazz(test-in-its-tests-folder)
                found: a module test outside the \`__tests__/\` of its folder
                why: The test of \`<dir>/<file>.ts\` is \`<dir>/__tests__/<file>.test.ts\` — the conventional folder of its module's folder, holding its tests, the typed data they read (\`<file>.fixtures.ts\`) and the ground they stand on.
                fix: move it to \`__tests__/beside.test.ts\`, and each relative path it imports one folder up (\`./<file>.js\` → \`../<file>.js\`)
                read: docs/reference/linting.md#test-in-its-tests-folder
        `);
    });
});
