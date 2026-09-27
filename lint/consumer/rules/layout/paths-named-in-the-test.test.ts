import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { pathsNamedInTheTest } from './paths-named-in-the-test.js';

const HELPER = '/repo/specs/api/orders/seeded.ts';
const IMPORT = "import { directory, file } from '@jterrazz/test';\n";

ruleTester().run('paths-named-in-the-test', pathsNamedInTheTest, {
    invalid: [
        // A shared helper that builds the path it hands on.
        {
            code: `${IMPORT}export const seeded = () => api.seed(file('./_seeds/orders.sql'));`,
            errors: [{ column: 37, line: 2, messageId: 'builtOutsideTest' }],
            filename: HELPER,
        },
        {
            code: `${IMPORT}export const shop = directory('../../_fixtures/shop/');`,
            errors: [{ column: 20, line: 2, messageId: 'builtOutsideTest' }],
            filename: HELPER,
        },
        // A specification file is no test either.
        {
            code: `${IMPORT}export const golden = file('./_expected/x.txt');`,
            errors: [{ column: 22, line: 2, messageId: 'builtOutsideTest' }],
            filename: '/repo/specs/api/api.specification.ts',
        },
        // An alias is the same call.
        {
            code: "import { file as disk } from '@jterrazz/test';\nexport const rows = disk('./_seeds/rows.sql');",
            errors: [{ column: 20, line: 2, messageId: 'builtOutsideTest' }],
            filename: HELPER,
        },
        // This repository's own entry, reached by path.
        {
            code: "import { file } from '../../../src/index.js';\nexport const rows = file('./_seeds/rows.sql');",
            errors: [{ column: 20, line: 2, messageId: 'builtOutsideTest' }],
            filename: HELPER,
        },
    ],
    valid: [
        // Built in the test, on the line a reader reads.
        {
            code: `${IMPORT}api.seed(file('./_seeds/orders.sql'));`,
            filename: '/repo/specs/api/orders/orders.spec.ts',
        },
        {
            code: `${IMPORT}expect(x).toMatch(file('./_expected/x.txt'));`,
            filename: '/repo/src/report/report.test.ts',
        },
        {
            code: `${IMPORT}expect(x).toMatch(file('./_expected/x.aria.yaml'));`,
            filename: '/repo/src/panel.test.tsx',
        },
        {
            code: `${IMPORT}const f = file('./_expected/x.txt');`,
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
