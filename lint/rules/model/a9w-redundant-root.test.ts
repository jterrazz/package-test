import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { a9wRedundantRoot } from './a9w-redundant-root.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The fs-anchored cases run against the shared E2E fixture trees (the
// Violation fixture has a package.json at its root, so the walk-up derives it).
const SPECS_LINT = resolve(import.meta.dirname, '../../../specs/lint');
const SPEC_FILE = `${SPECS_LINT}/a9w-redundant-root/fixtures/violation/specs/setup/rooted.specification.ts`;

ruleTester.run('a9w-redundant-root', a9wRedundantRoot as unknown as OxlintRule, {
    invalid: [
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
