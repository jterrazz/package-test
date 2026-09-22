import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c24GroundRole } from './c24-ground-role.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPEC = '/repo/specs/api/orders/orders.spec.ts';
const MODULE_TEST = '/repo/src/report/report.test.ts';

ruleTester.run('c24-ground-role', c24GroundRole as unknown as OxlintRule, {
    invalid: [
        { code: "api.seed(file('./fixtures/rows.sql'));", errors: 1, filename: SPEC },
        { code: "api.request(file('./expected/create.http'));", errors: 1, filename: SPEC },
        { code: "api.post('/orders', file('./fixtures/order.json'));", errors: 1, filename: SPEC },
        { code: "cli.fixture(directory('./expected/shop/'));", errors: 1, filename: SPEC },
        {
            code: "expect(r.stdout).toMatch(file('./requests/out.txt'));",
            errors: 1,
            filename: SPEC,
        },
        { code: "expect(r.stdout).toMatch(file('./out.txt'));", errors: 1, filename: MODULE_TEST },
        { code: "cli.run(file('./expected/case.spec.yaml'));", errors: 1, filename: SPEC },
        // A `const` is followed to the verb it reaches.
        {
            code: "const rows = file('./fixtures/rows.sql');\napi.seed(rows);",
            errors: 1,
            filename: SPEC,
        },
        {
            code: "test('x', async () => {\n    const golden = file('./requests/out.txt');\n    expect(r.stdout).toMatch(golden);\n});",
            errors: 1,
            filename: SPEC,
        },
        // The nearest declaration is the one the language reads.
        {
            code: "const shop = directory('./fixtures/shop/');\ntest('x', () => {\n    const shop = directory('./expected/shop/');\n    cli.fixture(shop);\n});",
            errors: 1,
            filename: SPEC,
        },
    ],
    valid: [
        { code: "api.seed(file('./seeds/rows.sql'), { database: 'db' });", filename: SPEC },
        { code: "api.request(file('./requests/create.http'));", filename: SPEC },
        { code: "api.put('/orders/1', file('./requests/order.json'));", filename: SPEC },
        { code: "cli.fixture(directory('../../fixtures/shop/'));", filename: SPEC },
        { code: "expect(r.stdout).toMatch(file('./expected/build/out.txt'));", filename: SPEC },
        { code: "expect(r.stdout).toMatch(file('./expected/out.txt'));", filename: MODULE_TEST },
        { code: "cli.run(file('./case.spec.yaml'));", filename: SPEC },
        // A deliberately wrong document is an input, kept where no glob collects it.
        { code: "cli.run(file('./fixtures/wrong-exit.spec.yaml'));", filename: SPEC },
        // A value is not the disk, and a computed path is out of reach.
        { code: "expect(r.stdout.text).toMatch('./fixtures/x');", filename: SPEC },
        { code: 'api.seed(file(path));', filename: SPEC },
        { code: "const rows = file('./seeds/rows.sql');\napi.seed(rows);", filename: SPEC },
        {
            code: "const shop = directory('./expected/shop/');\ntest('x', () => {\n    const shop = directory('./fixtures/shop/');\n    cli.fixture(shop);\n});",
            filename: SPEC,
        },
        // A binding that is not a const may be reassigned: out of reach.
        { code: "let rows = file('./fixtures/rows.sql');\napi.seed(rows);", filename: SPEC },
        // A parameter names what its caller hands it.
        { code: 'function seeded(rows) {\n    return api.seed(rows);\n}', filename: SPEC },
        // Production code is no test: the verbs there are the product's.
        { code: "client.post('/x', file('./fixtures/y.json'));", filename: '/repo/src/client.ts' },
    ],
});
