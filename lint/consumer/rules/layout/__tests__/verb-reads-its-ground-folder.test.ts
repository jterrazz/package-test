import { ruleTester } from '@jterrazz/test';

import { verbReadsItsGroundFolder } from '../verb-reads-its-ground-folder.js';

const SPEC = '/repo/specs/api/orders/orders.spec.ts';
const MODULE_TEST = '/repo/src/report/report.test.ts';

ruleTester().run('verb-reads-its-ground-folder', verbReadsItsGroundFolder, {
    invalid: [
        {
            name: 'A binding resolves through the blocks that enclose the call, never a sibling test’s; the message names a path with no ground folder.',
            code: "const rows = file('./rows.sql');\ntest('a', () => { const rows = file('./__seeds__/rows.sql'); api.seed(rows); });\ntest('b', () => { api.seed(rows); });",
            errors: [
                {
                    column: 27,
                    line: 3,
                    message:
                        /^found: `seed\(\)` reads __seeds__\/, and `file\('\.\/rows\.sql'\)` names no ground folder · why: .* · fix: move the file to \.\/__seeds__\/ beside the test, or in the __seeds__\/ of the lowest folder/u,
                },
            ],
            filename: SPEC,
        },
        {
            name: 'A verb that reads a document beside the test names that in its message.',
            code: "cli.run(file('./__expected__/case.spec.yaml'));",
            errors: [
                {
                    column: 13,
                    line: 1,
                    message:
                        /^found: `run\(\)` reads a document beside the test, and `file\('\.\/__expected__\/case\.spec\.yaml'\)` names __expected__\/ · why: .* · fix: move the file to the folder its verb reads, and name it from there/u,
                },
            ],
            filename: SPEC,
        },
        {
            code: "api.seed(file('./__fixtures__/rows.sql'));",
            errors: [{ column: 14, line: 1, messageId: 'crossed' }],
            filename: SPEC,
        },
        {
            code: "api.seed(file('../../__fixtures__/__seeds__/rows.sql'));",
            errors: [
                {
                    column: 14,
                    line: 1,
                    message:
                        /^found: `seed\(\)` reads __seeds__\/, and `file\('\.\.\/\.\.\/__fixtures__\/__seeds__\/rows\.sql'\)` names __fixtures__\/ · .* · fix: move the file to \.\/__seeds__\/ beside the test, or in the __seeds__\/ of the lowest folder the leaves share \(specs\/__seeds__\/ across specifications\)/u,
                },
            ],
            filename: SPEC,
        },
        {
            name: '`_shared/` is no role: a path into it passes through the role folder of what it holds.',
            code: "api.seed(file('../../_shared/rows.sql'));",
            errors: [{ column: 14, line: 1, messageId: 'crossed' }],
            filename: SPEC,
        },
        {
            code: "api.request(file('./__expected__/create.http'));",
            errors: [{ column: 17, line: 1, messageId: 'crossed' }],
            filename: SPEC,
        },
        {
            code: "api.post('/orders', file('./__fixtures__/order.json'));",
            errors: [{ column: 25, line: 1, messageId: 'crossed' }],
            filename: SPEC,
        },
        {
            code: "cli.fixture(directory('./__expected__/shop/'));",
            errors: [{ column: 22, line: 1, messageId: 'crossed' }],
            filename: SPEC,
        },
        {
            code: "expect(r.stdout).toMatch(file('./__requests__/out.txt'));",
            errors: [{ column: 30, line: 1, messageId: 'crossed' }],
            filename: SPEC,
        },
        {
            code: "expect(r.stdout).toMatch(file('./out.txt'));",
            errors: [{ column: 30, line: 1, messageId: 'crossed' }],
            filename: MODULE_TEST,
        },
        {
            code: "cli.run(file('./__expected__/case.spec.yaml'));",
            errors: [{ column: 13, line: 1, messageId: 'crossed' }],
            filename: SPEC,
        },
        {
            name: 'A `const` is followed to the verb it reaches.',
            code: "const rows = file('./__fixtures__/rows.sql');\napi.seed(rows);",
            errors: [{ column: 9, line: 2, messageId: 'crossed' }],
            filename: SPEC,
        },
        {
            name: "A binding is the file's own: the `rows` the case above declared names nothing here.",
            code: "api.seed(rows);\napi.seed(file('./__fixtures__/rows.sql'));",
            errors: [{ column: 14, line: 2, messageId: 'crossed' }],
            filename: SPEC,
        },
        {
            code: "test('x', async () => {\n    const golden = file('./__requests__/out.txt');\n    expect(r.stdout).toMatch(golden);\n});",
            errors: [{ column: 29, line: 3, messageId: 'crossed' }],
            filename: SPEC,
        },
        {
            name: 'The nearest declaration is the one the language reads.',
            code: "const shop = directory('./__fixtures__/shop/');\ntest('x', () => {\n    const shop = directory('./__expected__/shop/');\n    cli.fixture(shop);\n});",
            errors: [{ column: 16, line: 4, messageId: 'crossed' }],
            filename: SPEC,
        },
    ],
    valid: [
        { code: "api.seed(file('./__seeds__/rows.sql'), { database: 'db' });", filename: SPEC },
        {
            code: "api.seed(file('../../__seeds__/rows.sql'), { database: 'db' });",
            filename: SPEC,
        },
        { code: "api.request(file('../../__requests__/create.http'));", filename: SPEC },
        {
            code: "expect(r.response).toMatch(file('../../__expected__/list.http'));",
            filename: SPEC,
        },
        { code: "api.request(file('./__requests__/create.http'));", filename: SPEC },
        { code: "api.put('/orders/1', file('./__requests__/order.json'));", filename: SPEC },
        { code: "cli.fixture(directory('../../__fixtures__/shop/'));", filename: SPEC },
        { code: "expect(r.stdout).toMatch(file('./__expected__/build/out.txt'));", filename: SPEC },
        {
            code: "expect(r.stdout).toMatch(file('./__expected__/out.txt'));",
            filename: MODULE_TEST,
        },
        { code: "cli.run(file('./case.spec.yaml'));", filename: SPEC },
        {
            name: 'A deliberately wrong document is an input, kept where no glob collects it.',
            code: "cli.run(file('./__fixtures__/wrong-exit.spec.yaml'));",
            filename: SPEC,
        },
        {
            name: 'A value is not the disk, and a computed path is out of reach.',
            code: "expect(r.stdout.text).toMatch('./__fixtures__/x');",
            filename: SPEC,
        },
        { code: 'api.seed(file(path));', filename: SPEC },
        { code: "const rows = file('./__seeds__/rows.sql');\napi.seed(rows);", filename: SPEC },
        {
            code: "const shop = directory('./__expected__/shop/');\ntest('x', () => {\n    const shop = directory('./__fixtures__/shop/');\n    cli.fixture(shop);\n});",
            filename: SPEC,
        },
        {
            name: 'A binding that is not a const may be reassigned: out of reach.',
            code: "let rows = file('./__fixtures__/rows.sql');\napi.seed(rows);",
            filename: SPEC,
        },
        {
            name: 'A parameter names what its caller hands it.',
            code: 'function seeded(rows) {\n    return api.seed(rows);\n}',
            filename: SPEC,
        },
        {
            name: "Production code is no test: the verbs there are the product's.",
            code: "client.post('/x', file('./__fixtures__/y.json'));",
            filename: '/repo/src/client.ts',
        },
    ],
});
