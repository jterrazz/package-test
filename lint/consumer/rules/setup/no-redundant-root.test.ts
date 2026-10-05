import { ruleTester } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { checkoutUnder } from '../../../kit/testing/package-tree.fixtures.js';
import { noRedundantRoot } from './no-redundant-root.js';

// invariant: the fs-anchored cases run against the shared E2E fixture trees (the
// violation fixture has a package.json at its root, so the walk-up derives it).
const SPECS_LINT = resolve(import.meta.dirname, '../../../../specs/lint');
const SPEC_FILE = `${SPECS_LINT}/no-redundant-root/_fixtures/violation/specs/cli/rooted.specification.ts`;

const IGNORED_MARKER = checkoutUnder('work', ['pkg/specs']);
writeFileSync(join(IGNORED_MARKER, 'pkg/package.json'), '{}\n');
writeFileSync(join(IGNORED_MARKER, '.gitignore'), 'pkg/package.json\n');
mkdirSync(join(IGNORED_MARKER, 'pkg/specs'), { recursive: true });
execFileSync('git', ['init', '--quiet'], { cwd: IGNORED_MARKER });
const IGNORED_SPEC = join(IGNORED_MARKER, 'pkg/specs/rooted.specification.ts');

ruleTester().run('no-redundant-root', noRedundantRoot, {
    invalid: [
        {
            name: 'The checkout is what the runtime derives past an ignored marker.',
            code: 'await specification.cli("./bin", { root: "../.." });',
            errors: [{ column: 35, line: 1, messageId: 'redundant' }],
            filename: IGNORED_SPEC,
        },
        {
            name: "Every specification takes the option: an api runner's root is as redundant.",
            code: 'await specification.api({ root: "../..", server: () => app });',
            errors: [{ column: 26, line: 1, messageId: 'redundant' }],
            filename: SPEC_FILE,
        },
        {
            name: 'Root points exactly at the derived root (fixture root, via package.json).',
            code: 'await specification.cli("./bin", { root: "../.." });',
            errors: [{ column: 35, line: 1, messageId: 'redundant' }],
            filename: SPEC_FILE,
        },
    ],
    valid: [
        {
            name: 'A runner of no specification is none of this rule’s.',
            code: 'await other.cli("./bin", { root: "../.." });',
            filename: SPEC_FILE,
        },
        {
            name: 'An ignored marker is no root to either walk: naming it is an override.',
            code: 'await specification.cli("./bin", { root: ".." });',
            filename: IGNORED_SPEC,
        },
        {
            name: 'Root pointing somewhere else is a real override.',
            code: 'await specification.cli("./bin", { root: "../_fixtures/app" });',
            filename: SPEC_FILE,
        },
        {
            name: 'No root — the convention resolves it.',
            code: 'await specification.cli("./bin");',
            filename: SPEC_FILE,
        },
        {
            name: 'Dynamic roots are out of static reach.',
            code: 'await specification.cli("./bin", { root: someDir });',
            filename: SPEC_FILE,
        },
    ],
});
