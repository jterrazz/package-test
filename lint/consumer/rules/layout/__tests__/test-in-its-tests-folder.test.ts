import { ruleTester } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { checkoutUnder } from '../../../../__tests__/package-tree.fixtures.js';
import { testInItsTestsFolder } from '../test-in-its-tests-folder.js';

// invariant: each fixture tree carries its own package.json, which puts its `src/` outside a specs tree.
const OWN = resolve(
    import.meta.dirname,
    '../../../../../specs/lint/test-in-its-tests-folder/__fixtures__',
);
// invariant: the repo root DOES carry a package.json, the guard the rootTests branch reads.
const REPO_ROOT = resolve(import.meta.dirname, '../../../../..');

const UNSTAGED = checkoutUnder('work', ['src']);
writeFileSync(join(UNSTAGED, 'src/fresh.ts'), 'export {};\n');
writeFileSync(join(UNSTAGED, 'src/local.ts'), 'export {};\n');
writeFileSync(join(UNSTAGED, '.gitignore'), 'src/local.ts\n');
execFileSync('git', ['init', '--quiet'], { cwd: UNSTAGED });

ruleTester().run('test-in-its-tests-folder', testInItsTestsFolder, {
    invalid: [
        {
            name: 'A module `.gitignore` names is on no checkout: the test names nothing.',
            code: 'test("x", () => {});',
            errors: [{ column: 0, line: 1, messageId: 'orphanTest' }],
            filename: `${UNSTAGED}/src/__tests__/local.test.ts`,
        },
        {
            name: "No util.ts in the folder above the orphan's __tests__.",
            code: 'test("x", () => {});',
            errors: [
                {
                    column: 0,
                    line: 1,
                    message:
                        /^found: a module test naming no "util\.ts" in the folder above its `__tests__\/` · /u,
                },
            ],
            filename: `${OWN}/orphan/src/__tests__/util.test.ts`,
        },
        {
            name: 'A module test beside its module is moved into the __tests__ of its folder.',
            code: 'test("x", () => {});',
            errors: [
                {
                    column: 0,
                    line: 1,
                    message:
                        /^found: a module test outside the `__tests__\/` of its folder · .* · fix: move it to `__tests__\/beside\.test\.ts`/u,
                },
            ],
            filename: `${OWN}/orphan/src/beside.test.ts`,
        },
        {
            name: 'A component test outside a __tests__ folder answers to the same law.',
            code: 'test("x", () => {});',
            errors: [{ column: 0, line: 1, messageId: 'outsideTests' }],
            filename: '/repo/src/card.test.tsx',
        },
        {
            name: 'A rendered unit naming nothing — the same law, outside src/.',
            code: 'test("x", () => {});',
            errors: [
                {
                    column: 0,
                    line: 1,
                    message: /^found: a component test naming no "orphan-card\.tsx" · /u,
                },
            ],
            filename: `${OWN}/orphan/src/__tests__/orphan-card.test.tsx`,
        },
        {
            name: 'A rendered unit under specs/ with nothing beside it.',
            code: 'test("x", () => {});',
            errors: [{ column: 0, line: 1, messageId: 'orphanComponent' }],
            filename: `${OWN}/repository-suite/specs/build/missing-card.test.tsx`,
        },
        {
            name: 'A root-level tests/ dir (guarded by a real package.json at that root) is banned.',
            code: 'export {};',
            errors: [
                { column: 0, line: 1, message: /^found: a package-level `tests\/` directory · /u },
            ],
            filename: `${REPO_ROOT}/tests/foo.test.ts`,
        },
        {
            name: 'And so is the singular spelling of the same root.',
            code: 'export {};',
            errors: [{ column: 0, line: 1, messageId: 'rootTests' }],
            filename: `${REPO_ROOT}/test/corpus.test.ts`,
        },
    ],
    valid: [
        {
            name: 'A module that is no test owes nothing, and neither does a spec under specs/.',
            code: 'export {};',
            filename: `${OWN}/orphan/src/ghost.ts`,
        },
        { code: 'test("x", () => {});', filename: '/repo/specs/api/users/users.test.ts' },
        {
            name: 'A new module is named before anyone runs `git add`.',
            code: 'test("x", () => {});',
            filename: `${UNSTAGED}/src/__tests__/fresh.test.ts`,
        },
        {
            name: "The module sits in the folder above the test's __tests__.",
            code: 'test("x", () => {});',
            filename: `${OWN}/sibling/src/__tests__/util.test.ts`,
        },
        {
            name: 'Non-test files under src/ are untouched.',
            code: 'export {};',
            filename: `${OWN}/sibling/src/util.ts`,
        },
        {
            name: 'A component test naming the component it renders.',
            code: 'test("x", () => {});',
            filename: `${OWN}/sibling/src/__tests__/card.test.tsx`,
        },
        {
            name: "A hook's test is a .test.tsx naming the .ts, with its Host in the file.",
            code: 'test("x", () => {});',
            filename: `${OWN}/sibling/src/__tests__/use-toggle.test.tsx`,
        },
        {
            name: 'A .js module satisfies `test-in-its-tests-folder` too (JS-shipping packages).',
            code: 'test("x", () => {});',
            filename: `${OWN}/sibling/src/__tests__/helper.test.ts`,
        },
        {
            name: 'A REPOSITORY suite: a module-role test under a specs/ tree covers a tree, not one module — the rule requires `!inSpecs`.',
            code: 'test("x", () => {});',
            filename: `${OWN}/repository-suite/specs/build/a.test.ts`,
        },
    ],
});
