import { ruleTester } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { checkoutUnder } from '../../../kit/testing/package-tree.fixtures.js';
import { testBesideItsModule } from './test-beside-its-module.js';

// Each fixture tree carries its own package.json, which puts its `src/` outside a specs tree.
const FIXTURES = resolve(
    import.meta.dirname,
    '../../../../specs/lint/test-beside-its-module/_fixtures',
);
const OWN = resolve(import.meta.dirname, '../../../../specs/lint/test-beside-its-module/_fixtures');
// The repo root DOES carry a package.json — the guard the rootTests branch reads.
const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

const UNSTAGED = checkoutUnder('work', ['src']);
writeFileSync(join(UNSTAGED, 'src/fresh.ts'), 'export {};\n');
writeFileSync(join(UNSTAGED, 'src/local.ts'), 'export {};\n');
writeFileSync(join(UNSTAGED, '.gitignore'), 'src/local.ts\n');
execFileSync('git', ['init', '--quiet'], { cwd: UNSTAGED });

ruleTester().run('test-beside-its-module', testBesideItsModule, {
    invalid: [
        // A neighbour `.gitignore` names is on no checkout: the test is an orphan.
        {
            code: 'test("x", () => {});',
            errors: [{ column: 0, line: 1, messageId: 'orphanTest' }],
            filename: `${UNSTAGED}/src/local.test.ts`,
        },
        // No util.ts neighbour in the violation fixture.
        {
            code: 'test("x", () => {});',
            errors: [{ column: 0, line: 1, messageId: 'orphanTest' }],
            filename: `${OWN}/orphan/src/util.test.ts`,
        },
        // __tests__ directories are banned under src/.
        {
            code: 'export {};',
            errors: [{ column: 0, line: 1, messageId: 'testsDir' }],
            filename: '/repo/src/specification/__tests__/match.test.ts',
        },
        // A rendered unit with nothing beside it — the same law, outside src/.
        {
            code: 'test("x", () => {});',
            errors: [{ column: 0, line: 1, messageId: 'orphanComponent' }],
            filename: `${OWN}/orphan/src/orphan-card.test.tsx`,
        },
        // A root-level tests/ dir (guarded by a real package.json at that root) is banned.
        {
            code: 'export {};',
            errors: [{ column: 0, line: 1, messageId: 'rootTests' }],
            filename: `${REPO_ROOT}/tests/foo.test.ts`,
        },
        // And so is the singular spelling of the same root.
        {
            code: 'export {};',
            errors: [{ column: 0, line: 1, messageId: 'rootTests' }],
            filename: `${REPO_ROOT}/test/corpus.test.ts`,
        },
    ],
    valid: [
        // A new module is a neighbour before anyone runs `git add`.
        {
            code: 'test("x", () => {});',
            filename: `${UNSTAGED}/src/fresh.test.ts`,
        },
        // Neighbour exists in the compliant twin.
        {
            code: 'test("x", () => {});',
            filename: `${OWN}/sibling/src/util.test.ts`,
        },
        // Non-test files under src/ are untouched.
        {
            code: 'export {};',
            filename: `${OWN}/sibling/src/util.ts`,
        },
        // A component test beside the component it renders.
        {
            code: 'test("x", () => {});',
            filename: `${OWN}/sibling/src/card.test.tsx`,
        },
        // A hook's test is a .test.tsx beside the .ts, with its Host in the file.
        {
            code: 'test("x", () => {});',
            filename: `${OWN}/sibling/src/use-toggle.test.tsx`,
        },
        // A .js neighbour satisfies `test-beside-its-module` too (JS-shipping packages).
        {
            code: 'test("x", () => {});',
            filename: `${OWN}/sibling/src/helper.test.ts`,
        },
        // A REPOSITORY suite: a module-role test under a specs/ tree covers a
        // tree, not one module — the orphan clause requires `!inSpecs`.
        {
            code: 'test("x", () => {});',
            filename: `${FIXTURES}/repository-suite/specs/build/a.test.ts`,
        },
    ],
});
