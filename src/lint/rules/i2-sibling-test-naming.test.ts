import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { i2SiblingTestNaming } from './i2-sibling-test-naming.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// The fs-anchored cases run against the shared E2E fixture trees.
const FIXTURES = resolve(import.meta.dirname, '../../../specs/fixtures/lint-violations');
// The repo root DOES carry a package.json — the guard the rootTests branch reads.
const REPO_ROOT = resolve(import.meta.dirname, '../../..');

ruleTester.run('i2-sibling-test-naming', i2SiblingTestNaming as unknown as OxlintRule, {
    invalid: [
        // No util.ts neighbour in the violation fixture.
        {
            code: 'test("x", () => {});',
            errors: [{ messageId: 'orphanTest' }],
            filename: `${FIXTURES}/i2-sibling-test-naming/src/util.test.ts`,
        },
        // __tests__ directories are banned under src/.
        {
            code: 'export {};',
            errors: [{ messageId: 'testsDir' }],
            filename: '/repo/src/core/__tests__/match.test.ts',
        },
        // A root-level tests/ dir (guarded by a real package.json at that root) is banned.
        {
            code: 'export {};',
            errors: [{ messageId: 'rootTests' }],
            filename: `${REPO_ROOT}/tests/foo.test.ts`,
        },
    ],
    valid: [
        // Neighbour exists in the compliant twin.
        {
            code: 'test("x", () => {});',
            filename: `${FIXTURES}/i2-sibling-test-naming-ok/src/util.test.ts`,
        },
        // Non-test files under src/ are untouched.
        {
            code: 'export {};',
            filename: `${FIXTURES}/i2-sibling-test-naming-ok/src/util.ts`,
        },
        // A .js neighbour satisfies I2 too (JS-shipping packages).
        {
            code: 'test("x", () => {});',
            filename: `${FIXTURES}/i2-sibling-test-naming-ok/src/helper.test.ts`,
        },
        // A tests/ path with NO package.json at its root candidate is not flagged
        // (the guard prevents matching arbitrary nested `tests/` segments).
        {
            code: 'export {};',
            filename: '/no-such-root-xyz/tests/foo.test.ts',
        },
    ],
});
