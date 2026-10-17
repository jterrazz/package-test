import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('tests-folder', () => {
    test("a module test's ground under __tests__/ is judged as a specification's", async () => {
        // Given - a module test reading one short golden of its __tests__/__expected__/, beside one nothing reads
        const result = await checker.fixture(directory('./__fixtures__/tests-folder/')).run();

        // Then - the golden one test reads belongs in place, and the one no test reads is dead
        expect(result.report).toMatch(`
            src/render/__tests__/__expected__/gone.aria.txt:1:1  jterrazz-check(no-unused-ground)
                found: __expected__/gone.aria.txt, which no test of __tests__ names
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced: a folder's by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete __expected__/gone.aria.txt, or name it from the test that stands on it
                read: docs/reference/linting.md#no-unused-ground
            src/render/__tests__/heading.test.ts:9:42  jterrazz-check(ground-shared-or-inline)
                found: src/render/__tests__/__expected__/notes.aria.txt, read by this test alone
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: write it here, the value \`toMatch\` compares, and delete the file; \`typescript fix\` inlines it
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('--fix writes the golden a module test alone reads in place, and leaves the dead one to its author', async () => {
        // Given - the same tree, fixed
        const result = await checker
            .fixture(directory('./__fixtures__/tests-folder/'))
            .run({ fix: true });

        // Then - the value stands in the test, its file is gone, and the golden no test reads is still reported
        expect(result.file('src/render/__tests__/__expected__/notes.aria.txt').exists).toBe(false);
        expect(result.file('src/render/__tests__/heading.test.ts').content).toBe(
            [
                "import { describe, expect, test } from 'vitest';",
                '',
                "import { heading } from '../heading.js';",
                '',
                "describe('heading', () => {",
                "    test('names its level', () => {",
                '        // Then - the tree a reader hears',
                "        expect(heading('Notes')).toMatch(`",
                '            heading "Notes" [level=1]',
                '        `);',
                '    });',
                '});',
                '',
            ].join('\n'),
        );
        expect(result.report).toMatch(`
            src/render/__tests__/__expected__/gone.aria.txt:1:1  jterrazz-check(no-unused-ground)
                found: __expected__/gone.aria.txt, which no test of __tests__ names
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced: a folder's by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete __expected__/gone.aria.txt, or name it from the test that stands on it
                read: docs/reference/linting.md#no-unused-ground
        `);
    });
});
