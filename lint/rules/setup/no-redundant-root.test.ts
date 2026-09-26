import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { checkoutUnder } from '../../reading/package-tree.fixtures.js';
import { noRedundantRoot } from './no-redundant-root.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The fs-anchored cases run against the shared E2E fixture trees (the
// violation fixture has a package.json at its root, so the walk-up derives it).
const SPECS_LINT = resolve(import.meta.dirname, '../../../specs/lint');
const SPEC_FILE = `${SPECS_LINT}/no-redundant-root/fixtures/violation/specs/cli/rooted.specification.ts`;

const IGNORED_MARKER = checkoutUnder('work', ['pkg/specs']);
writeFileSync(join(IGNORED_MARKER, 'pkg/package.json'), '{}\n');
writeFileSync(join(IGNORED_MARKER, '.gitignore'), 'pkg/package.json\n');
mkdirSync(join(IGNORED_MARKER, 'pkg/specs'), { recursive: true });
execFileSync('git', ['init', '--quiet'], { cwd: IGNORED_MARKER });
const IGNORED_SPEC = join(IGNORED_MARKER, 'pkg/specs/rooted.specification.ts');

ruleTester.run('no-redundant-root', noRedundantRoot as unknown as OxlintRule, {
    invalid: [
        // The checkout is what the runtime derives past an ignored marker.
        {
            code: 'await specification.cli("./bin", { root: "../.." });',
            errors: 1,
            filename: IGNORED_SPEC,
        },
        // Every facet takes the option: an api runner's root is as redundant.
        {
            code: 'await specification.api({ root: "../..", server: () => app });',
            errors: 1,
            filename: SPEC_FILE,
        },
        // Root points exactly at the derived root (fixture root, via package.json).
        {
            code: 'await specification.cli("./bin", { root: "../.." });',
            errors: 1,
            filename: SPEC_FILE,
        },
    ],
    valid: [
        // An ignored marker is no root to either walk: naming it is an override.
        {
            code: 'await specification.cli("./bin", { root: ".." });',
            filename: IGNORED_SPEC,
        },
        // Root pointing somewhere else is a real override.
        {
            code: 'await specification.cli("./bin", { root: "../fixtures/app" });',
            filename: SPEC_FILE,
        },
        // No root — the convention resolves it.
        {
            code: 'await specification.cli("./bin");',
            filename: SPEC_FILE,
        },
        // Dynamic roots are out of static reach.
        {
            code: 'await specification.cli("./bin", { root: someDir });',
            filename: SPEC_FILE,
        },
    ],
});
