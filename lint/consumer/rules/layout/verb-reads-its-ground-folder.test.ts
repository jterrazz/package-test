import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { verbReadsItsGroundFolder } from './verb-reads-its-ground-folder.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPEC = '/repo/specs/api/orders/orders.spec.ts';
const MODULE_TEST = '/repo/src/report/report.test.ts';

ruleTester.run('verb-reads-its-ground-folder', verbReadsItsGroundFolder as unknown as OxlintRule, {
    invalid: [
        { code: "api.seed(file('./_fixtures/rows.sql'));", errors: 1, filename: SPEC },
        {
            code: "api.seed(file('../../_shared/_fixtures/_seeds/rows.sql'));",
            errors: [
                {
                    message:
                        /^found: `seed\(\)` reads _seeds\/, and `file\('\.\.\/\.\.\/_shared\/_fixtures\/_seeds\/rows\.sql'\)` names _fixtures\/ · .* · fix: move the file to \.\/_seeds\/ beside the test, or in the _seeds\/ of the lowest folder the leaves share \(specs\/_shared\/_seeds\/ across facets\)/u,
                },
            ],
            filename: SPEC,
        },
        // `_shared/` is no role: a path into it passes through the role folder of what it holds.
        { code: "api.seed(file('../../_shared/rows.sql'));", errors: 1, filename: SPEC },
        { code: "api.request(file('./_expected/create.http'));", errors: 1, filename: SPEC },
        { code: "api.post('/orders', file('./_fixtures/order.json'));", errors: 1, filename: SPEC },
        { code: "cli.fixture(directory('./_expected/shop/'));", errors: 1, filename: SPEC },
        {
            code: "expect(r.stdout).toMatch(file('./_requests/out.txt'));",
            errors: 1,
            filename: SPEC,
        },
        { code: "expect(r.stdout).toMatch(file('./out.txt'));", errors: 1, filename: MODULE_TEST },
        { code: "cli.run(file('./_expected/case.spec.yaml'));", errors: 1, filename: SPEC },
        // A `const` is followed to the verb it reaches.
        {
            code: "const rows = file('./_fixtures/rows.sql');\napi.seed(rows);",
            errors: 1,
            filename: SPEC,
        },
        // A binding is the file's own: the `rows` the case above declared names nothing here.
        {
            code: "api.seed(rows);\napi.seed(file('./_fixtures/rows.sql'));",
            errors: 1,
            filename: SPEC,
        },
        {
            code: "test('x', async () => {\n    const golden = file('./_requests/out.txt');\n    expect(r.stdout).toMatch(golden);\n});",
            errors: 1,
            filename: SPEC,
        },
        // The nearest declaration is the one the language reads.
        {
            code: "const shop = directory('./_fixtures/shop/');\ntest('x', () => {\n    const shop = directory('./_expected/shop/');\n    cli.fixture(shop);\n});",
            errors: 1,
            filename: SPEC,
        },
    ],
    valid: [
        { code: "api.seed(file('./_seeds/rows.sql'), { database: 'db' });", filename: SPEC },
        {
            code: "api.seed(file('../../_shared/_seeds/rows.sql'), { database: 'db' });",
            filename: SPEC,
        },
        { code: "api.request(file('../../_shared/_requests/create.http'));", filename: SPEC },
        {
            code: "expect(r.response).toMatch(file('../../_shared/_expected/list.http'));",
            filename: SPEC,
        },
        { code: "api.request(file('./_requests/create.http'));", filename: SPEC },
        { code: "api.put('/orders/1', file('./_requests/order.json'));", filename: SPEC },
        { code: "cli.fixture(directory('../../_shared/_fixtures/shop/'));", filename: SPEC },
        { code: "expect(r.stdout).toMatch(file('./_expected/build/out.txt'));", filename: SPEC },
        { code: "expect(r.stdout).toMatch(file('./_expected/out.txt'));", filename: MODULE_TEST },
        { code: "cli.run(file('./case.spec.yaml'));", filename: SPEC },
        // A deliberately wrong document is an input, kept where no glob collects it.
        { code: "cli.run(file('./_fixtures/wrong-exit.spec.yaml'));", filename: SPEC },
        // A value is not the disk, and a computed path is out of reach.
        { code: "expect(r.stdout.text).toMatch('./_fixtures/x');", filename: SPEC },
        { code: 'api.seed(file(path));', filename: SPEC },
        { code: "const rows = file('./_seeds/rows.sql');\napi.seed(rows);", filename: SPEC },
        {
            code: "const shop = directory('./_expected/shop/');\ntest('x', () => {\n    const shop = directory('./_fixtures/shop/');\n    cli.fixture(shop);\n});",
            filename: SPEC,
        },
        // A binding that is not a const may be reassigned: out of reach.
        { code: "let rows = file('./_fixtures/rows.sql');\napi.seed(rows);", filename: SPEC },
        // A parameter names what its caller hands it.
        { code: 'function seeded(rows) {\n    return api.seed(rows);\n}', filename: SPEC },
        // Production code is no test: the verbs there are the product's.
        { code: "client.post('/x', file('./_fixtures/y.json'));", filename: '/repo/src/client.ts' },
    ],
});
