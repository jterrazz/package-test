import { ruleTester } from '@jterrazz/test';
import { join } from 'node:path';

import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import { noTestCodeInProduction } from './no-test-code-in-production.js';

// invariant: one package on disk: the aliases, the stubs folders and the modules a
// reference passes through are read from the tree beside the linted file.
const ROOT = packageWith({
    'package.json': JSON.stringify({
        imports: { '#domain/*': './src/domain/*', '#fixtures/*': './specs/_fixtures/*' },
        name: 'app',
    }),
    'specs/_fixtures/users.ts': 'export const users = [];\n',
    'src/domain/helpers.ts': "import { user } from './user.fixtures.js';\nexport { user };\n",
    'src/features/stubs/http/events.ts': 'export default {};\n',
    'src/features/stubs/news.stubs.ts': 'export const news = {};\n',
    'src/model/stubs/network.ts': 'export const network = {};\n',
    'tests/data.ts': "export * from '../specs/_fixtures/users.js';\n",
    'tests/render.ts': "export { render } from '@testing-library/react';\n",
    'tests/format.ts': 'export const format = String;\n',
    'tests/rows.ts':
        "export const rows = new URL('../specs/_fixtures/rows.json', import.meta.url);\n",
    'tsconfig.json': [
        '{',
        '    // The aliases a module may be reached by.',
        '    "compilerOptions": {',
        '        "paths": { "@app/*": ["./src/*"], "@test-data/*": ["./specs/_fixtures/*"] },',
        '    },',
        '}',
    ].join('\n'),
});

const PROD = join(ROOT, 'src/domain/user.ts');

// invariant: a service whose product IS a browser, and says so in its config.
const GATE = packageWith({
    'jterrazz.config.ts':
        "export default { test: { production: { allow: { playwright: 'the gate drives a browser in production' } } } };\n",
    'package.json': JSON.stringify({ name: 'gate' }),
    'tests/browser.ts': "export { chromium } from 'playwright';\n",
    'tests/server.ts': "export { setupServer } from 'msw/node';\n",
});
const GATE_SERVICE = join(GATE, 'src/browser/service.ts');
const BARREL = join(ROOT, 'src/index.ts');

const refused = (
    code: string,
    messageId: string,
    [line, column]: [number, number],
    filename = PROD,
) => ({
    code,
    errors: [{ column, line, messageId }],
    filename,
});

ruleTester().run('no-test-code-in-production', noTestCodeInProduction, {
    invalid: [
        // invariant: an allowed package is the only one: the unit's other test packages stay refused.
        refused('import { expect } from "vitest";', 'reach', [1, 23], GATE_SERVICE),
        // invariant: through a relay that is not production, the other packages stay refused too.
        refused(
            'export { setupServer } from "../../tests/server.js";',
            'reachThrough',
            [1, 28],
            GATE_SERVICE,
        ),
        // invariant: the test packages.
        refused('import { expect } from "vitest";', 'reach', [1, 23]),
        refused('import { mockOf } from "@jterrazz/test";', 'reach', [1, 23]),
        refused('import { expect } from "@vitest/expect";', 'reach', [1, 23]),
        refused('import { setupServer } from "msw/node";', 'reach', [1, 28]),
        refused('import { render } from "@testing-library/react";', 'reach', [1, 23]),
        refused('import { chromium } from "playwright";', 'reach', [1, 25]),
        // invariant: test files, by their suffix.
        refused('import { helper } from "./user.test.js";', 'reach', [1, 23]),
        refused('import { helper } from "./user.spec.js";', 'reach', [1, 23]),
        refused('import { api } from "../api.specification.js";', 'reach', [1, 20]),
        refused('import { data } from "./user.fixtures.js";', 'reach', [1, 21]),
        refused('import type { Row } from "./user.test-d.js";', 'reach', [1, 25]),
        // invariant: ground, wherever it sits, and the specs tree.
        refused('import rows from "./_fixtures/rows.js";', 'reach', [1, 17]),
        refused('import golden from "../_expected/user.json";', 'reach', [1, 19]),
        refused('import body from "./_requests/create.js";', 'reach', [1, 17]),
        refused('import rows from "./_seeds/rows.js";', 'reach', [1, 17]),
        refused(
            'import { users } from "../../specs/_shared/_fixtures/users.js";',
            'reach',
            [1, 22],
        ),
        refused('import { seed } from "../../specs/_shared/_setup/seed.js";', 'reach', [1, 21]),
        // invariant: stubs: the facade, and a unit of the folder it makes a stubs folder.
        refused('import { news } from "./news.stubs.js";', 'reach', [1, 21]),
        refused('import { news } from "../features/stubs/news.stubs.js";', 'reach', [1, 21]),
        refused('import events from "../features/stubs/http/events.js";', 'reach', [1, 19]),
        // invariant: every form a module names another in.
        refused('import type { User } from "./user.fixtures.js";', 'reach', [1, 26]),
        refused('export { user } from "./user.fixtures.js";', 'reach', [1, 21]),
        refused('export * from "./user.fixtures.js";', 'reach', [1, 14]),
        refused('export * as data from "./user.fixtures.js";', 'reach', [1, 22]),
        refused('const data = await import("./user.fixtures.js");', 'reach', [1, 26]),
        refused('const data = require("./user.fixtures.js");', 'reach', [1, 21]),
        refused('const path = require.resolve("vitest");', 'reach', [1, 29]),
        refused('const path = import.meta.resolve("./user.fixtures.js");', 'reach', [1, 33]),
        refused('import msw = require("msw");', 'reach', [1, 21]),
        refused('type User = import("./user.fixtures.js").User;', 'reach', [1, 19]),
        // invariant: an alias that resolves to test material.
        refused('import { users } from "@test-data/users";', 'reach', [1, 22]),
        refused('import { users } from "#fixtures/users.js";', 'reach', [1, 22]),
        // invariant: a path the module builds from where it sits, or reads.
        refused(
            'const rows = new URL("./_fixtures/rows.json", import.meta.url);',
            'pathRead',
            [1, 21],
        ),
        refused(
            'const rows = new URL("../../specs/_fixtures/", import.meta.url);',
            'pathRead',
            [1, 21],
        ),
        refused(
            'const rows = readFileSync("./specs/_fixtures/rows.json", "utf8");',
            'pathRead',
            [1, 26],
        ),
        refused('const app = readFileSync("./specs/api/app.ts", "utf8");', 'pathRead', [1, 25]),
        refused(
            'const rows = readFileSync(join(import.meta.dirname, "_fixtures", "rows.json"));',
            'pathRead',
            [1, 26],
        ),
        refused(
            'const here = dirname(fileURLToPath(import.meta.url));\nconst all = readdirSync(join(here, "..", "_seeds", name));',
            'pathRead',
            [2, 24],
        ),
        refused(`const golden = \`\${__dirname}/_expected/out.txt\`;`, 'pathRead', [1, 15]),
        // invariant: a reach through a module that is not production — a separate test root: the barrel re-exports it.
        refused('export * from "../tests/render.js";', 'reachThrough', [1, 14], BARREL),
        refused('export { users } from "../tests/data.js";', 'reachThrough', [1, 22], BARREL),
        // invariant: that module is parsed: a path it builds into test material is a reach too.
        refused('export { rows } from "../tests/rows.js";', 'reachThrough', [1, 21], BARREL),
        // invariant: production is every module outside the test material: `lint/`, a script, a bin, the root.
        refused('import { it } from "vitest";', 'reach', [1, 19], join(ROOT, 'lint/rule.ts')),
        refused(
            'import { expect } from "vitest";',
            'reach',
            [1, 23],
            join(ROOT, 'scripts/seed.ts'),
        ),
        refused(
            'import { users } from "./specs/_fixtures/users.js";',
            'reach',
            [1, 22],
            join(ROOT, 'index.ts'),
        ),
        refused(
            'const { mockOf } = require("@jterrazz/test");',
            'reach',
            [1, 27],
            join(ROOT, 'bin/cli.cjs'),
        ),
    ],
    valid: [
        {
            name: "A test package the unit's `test.production.allow` names, with its reason.",
            code: 'import { chromium } from "playwright";',
            filename: GATE_SERVICE,
        },
        {
            name: 'An allowed package reaches nothing through a relay that is not production either.',
            code: 'export { chromium } from "../../tests/browser.js";',
            filename: GATE_SERVICE,
        },
        {
            name: 'Prod importing prod — a name that merely contains a ground word included.',
            code: 'import { other } from "./other.js";',
            filename: PROD,
        },
        { code: 'import { seedsOf } from "./seeds-of.js";', filename: PROD },
        {
            name: 'An alias that resolves to production.',
            code: 'import { other } from "@app/domain/other";',
            filename: PROD,
        },
        { code: 'import { other } from "#domain/other.js";', filename: PROD },
        {
            name: 'A folder named `stubs/` with no facade is not a stubs folder.',
            code: 'import { network } from "../model/stubs/network.js";',
            filename: PROD,
        },
        {
            name: 'The barrel is clean: the finding is on the helper that imports the fixtures.',
            code: 'export * from "./domain/helpers.js";',
            filename: BARREL,
        },
        {
            name: 'A module that is not production and reaches nothing.',
            code: 'export * from "../tests/format.js";',
            filename: BARREL,
        },
        {
            name: "A path built from a root the caller hands in is not the module's own tree.",
            code: 'const all = readdirSync(join(root, "_fixtures"));',
            filename: PROD,
        },
        { code: 'const asset = new URL("./assets/logo.png", import.meta.url);', filename: PROD },
        { code: 'const config = readFileSync("./config.json", "utf8");', filename: PROD },
        {
            name: 'A test reads its ground, and imports test artefacts freely.',
            code: 'import rows from "./_fixtures/rows.js";',
            filename: join(ROOT, 'src/user.test.ts'),
        },
        { code: 'import { mockOf } from "@jterrazz/test";', filename: join(ROOT, 'src/a.test.ts') },
        { code: 'import { expectTypeOf } from "vitest";', filename: join(ROOT, 'src/a.test-d.ts') },
        {
            code: 'import { specification } from "@jterrazz/test";',
            filename: join(ROOT, 'specs/api/api.specification.ts'),
        },
        {
            name: "A tool's config is the toolchain's, and a separate test root is `test-beside-its-module`'s.",
            code: 'import { defineConfig } from "vitest/config";',
            filename: join(ROOT, 'vitest.config.ts'),
        },
        { code: 'import { expect } from "vitest";', filename: join(ROOT, 'tests/helpers.ts') },
        {
            name: 'The lint entry is exempt: a shared oxlint preset imports it.',
            code: 'import { recommendedRules } from "@jterrazz/test/oxlint";',
            filename: PROD,
        },
    ],
});
