import { ruleTester } from '@jterrazz/test';

import { pathsNamedInTheTest } from './paths-named-in-the-test.js';

const HELPER = '/repo/specs/api/orders/seeded.ts';
const IMPORT = "import { directory, file } from '@jterrazz/test';\n";

ruleTester().run('paths-named-in-the-test', pathsNamedInTheTest, {
    invalid: [
        {
            name: 'A shared helper that builds the path it hands on.',
            code: `${IMPORT}export const seeded = () => api.seed(file('./_seeds/orders.sql'));`,
            errors: [{ column: 37, line: 2, messageId: 'builtOutsideTest' }],
            filename: HELPER,
        },
        {
            code: `${IMPORT}export const shop = directory('../../_fixtures/shop/');`,
            errors: [{ column: 20, line: 2, messageId: 'builtOutsideTest' }],
            filename: HELPER,
        },
        {
            name: 'A specification file is no test either.',
            code: `${IMPORT}export const golden = file('./_expected/x.txt');`,
            errors: [{ column: 22, line: 2, messageId: 'builtOutsideTest' }],
            filename: '/repo/specs/api/api.specification.ts',
        },
        {
            name: 'An alias is the same call.',
            code: "import { file as disk } from '@jterrazz/test';\nexport const rows = disk('./_seeds/rows.sql');",
            errors: [{ column: 20, line: 2, messageId: 'builtOutsideTest' }],
            filename: HELPER,
        },
        {
            name: "This repository's own entry, reached by path.",
            code: "import { file } from '../../../src/index.js';\nexport const rows = file('./_seeds/rows.sql');",
            errors: [{ column: 20, line: 2, messageId: 'builtOutsideTest' }],
            filename: HELPER,
        },
    ],
    valid: [
        {
            name: 'An entry no relative path names, a source that only starts like one, a default import and another name build no path.',
            code: "import { file } from 'other/src/index.js';\nimport { directory } from '../../../src/index.json';\nimport dflt, { api } from '@jterrazz/test';\nexport const a = file('./x');\nexport const b = directory('./y');\nexport const c = dflt('./z');\nexport const d = api('./w');",
            filename: HELPER,
        },
        {
            name: 'Built in the test, on the line a reader reads.',
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
            filename: '/repo/src/index.test-d.ts',
        },
        {
            name: 'A helper that takes it as a parameter.',
            code: "import type { DiskFile } from '@jterrazz/test';\nexport const seeded = (rows: DiskFile) => api.seed(rows);",
            filename: HELPER,
        },
        {
            name: "Another package's `file`, or a result accessor, is not the framework's.",
            code: "import { file } from './paths.js';\nexport const p = file('x');",
            filename: HELPER,
        },
        { code: 'export const content = result.file("out.txt").content;', filename: HELPER },
    ],
});
