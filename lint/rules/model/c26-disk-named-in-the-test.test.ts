import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c26DiskNamedInTheTest } from './c26-disk-named-in-the-test.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const HELPER = '/repo/specs/api/orders/seeded.ts';
const IMPORT = "import { directory, file } from '@jterrazz/test';\n";

ruleTester.run('c26-disk-named-in-the-test', c26DiskNamedInTheTest as unknown as OxlintRule, {
    invalid: [
        // A shared helper that builds the path it hands on.
        {
            code: `${IMPORT}export const seeded = () => api.seed(file('./seeds/orders.sql'));`,
            errors: 1,
            filename: HELPER,
        },
        {
            code: `${IMPORT}export const shop = directory('../../fixtures/shop/');`,
            errors: 1,
            filename: HELPER,
        },
        // A specification file is no test either.
        {
            code: `${IMPORT}export const golden = file('./expected/x.txt');`,
            errors: 1,
            filename: '/repo/specs/api/api.specification.ts',
        },
        // An alias is the same call.
        {
            code: "import { file as disk } from '@jterrazz/test';\nexport const rows = disk('./seeds/rows.sql');",
            errors: 1,
            filename: HELPER,
        },
        // This repository's own entry, reached by path.
        {
            code: "import { file } from '../../../src/index.js';\nexport const rows = file('./seeds/rows.sql');",
            errors: 1,
            filename: HELPER,
        },
    ],
    valid: [
        // Built in the test, on the line a reader reads.
        {
            code: `${IMPORT}api.seed(file('./seeds/orders.sql'));`,
            filename: '/repo/specs/api/orders/orders.spec.ts',
        },
        {
            code: `${IMPORT}expect(x).toMatch(file('./expected/x.txt'));`,
            filename: '/repo/src/report/report.test.ts',
        },
        {
            code: `${IMPORT}expect(x).toMatch(file('./expected/x.aria.yaml'));`,
            filename: '/repo/src/panel.test.tsx',
        },
        {
            code: `${IMPORT}const f = file('./expected/x.txt');`,
            filename: '/repo/src/type-channel.test-d.ts',
        },
        // A helper that takes it as a parameter.
        {
            code: "import type { DiskFile } from '@jterrazz/test';\nexport const seeded = (rows: DiskFile) => api.seed(rows);",
            filename: HELPER,
        },
        // Another package's `file`, or a result accessor, is not the framework's.
        {
            code: "import { file } from './paths.js';\nexport const p = file('x');",
            filename: HELPER,
        },
        { code: 'export const content = result.file("out.txt").content;', filename: HELPER },
    ],
});
