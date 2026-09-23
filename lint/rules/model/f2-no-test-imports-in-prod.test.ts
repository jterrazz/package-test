import { join } from 'node:path';

import { asOxlintRule, packageWith, ruleTester } from '../../rule-tester.fixtures.js';
import { f2NoTestImportsInProd } from './f2-no-test-imports-in-prod.js';

// One package on disk: the aliases, the contracts folders and the modules a
// Reference passes through are read from the tree beside the linted file.
const ROOT = packageWith({
    'package.json': JSON.stringify({
        imports: { '#domain/*': './src/domain/*', '#fixtures/*': './specs/fixtures/*' },
        name: 'app',
    }),
    'specs/fixtures/users.ts': 'export const users = [];\n',
    'src/domain/helpers.ts': "import { user } from './user.fixtures.js';\nexport { user };\n",
    'src/features/contracts/http/events.ts': 'export default {};\n',
    'src/features/contracts/news.contracts.ts': 'export const news = {};\n',
    'src/model/contracts/engine.ts': 'export const engine = {};\n',
    'testing/data.ts': "export * from '../specs/fixtures/users.js';\n",
    'testing/render.ts': "export { render } from '@testing-library/react';\n",
    'testing/format.ts': 'export const format = String;\n',
    'tsconfig.json': [
        '{',
        '    // The aliases a module may be reached by.',
        '    "compilerOptions": {',
        '        "paths": { "@app/*": ["./src/*"], "@test-data/*": ["./specs/fixtures/*"] },',
        '    },',
        '}',
    ].join('\n'),
});

const PROD = join(ROOT, 'src/domain/user.ts');
const BARREL = join(ROOT, 'src/index.ts');

/** A case in the production module, and the message it must raise. */
const refused = (code: string, messageId: string, filename = PROD) => ({
    code,
    errors: [{ messageId }],
    filename,
});

ruleTester().run('f2-no-test-imports-in-prod', asOxlintRule(f2NoTestImportsInProd), {
    invalid: [
        // The test packages.
        refused('import { expect } from "vitest";', 'reach'),
        refused('import { mockOf } from "@jterrazz/test";', 'reach'),
        refused('import { expect } from "@vitest/expect";', 'reach'),
        refused('import { setupServer } from "msw/node";', 'reach'),
        refused('import { render } from "@testing-library/react";', 'reach'),
        refused('import { chromium } from "playwright";', 'reach'),
        // Test files, by their suffix.
        refused('import { helper } from "./user.test.js";', 'reach'),
        refused('import { helper } from "./user.spec.js";', 'reach'),
        refused('import { api } from "../api.specification.js";', 'reach'),
        refused('import { data } from "./user.fixtures.js";', 'reach'),
        refused('import type { Row } from "./user.test-d.js";', 'reach'),
        // Ground, wherever it sits, and the specs tree.
        refused('import rows from "./fixtures/rows.js";', 'reach'),
        refused('import golden from "../expected/user.json";', 'reach'),
        refused('import body from "./requests/create.js";', 'reach'),
        refused('import rows from "./seeds/rows.js";', 'reach'),
        refused('import { users } from "../../specs/fixtures/users.js";', 'reach'),
        refused('import { seed } from "../../specs/setup/seed.js";', 'reach'),
        // Contracts: the facade, and a unit of the folder it makes a contracts folder.
        refused('import { news } from "./news.contracts.js";', 'reach'),
        refused('import { news } from "../features/contracts/news.contracts.js";', 'reach'),
        refused('import events from "../features/contracts/http/events.js";', 'reach'),
        // Every form a module names another in.
        refused('import type { User } from "./user.fixtures.js";', 'reach'),
        refused('export { user } from "./user.fixtures.js";', 'reach'),
        refused('export * from "./user.fixtures.js";', 'reach'),
        refused('export * as data from "./user.fixtures.js";', 'reach'),
        refused('const data = await import("./user.fixtures.js");', 'reach'),
        refused('const data = require("./user.fixtures.js");', 'reach'),
        refused('const path = require.resolve("vitest");', 'reach'),
        refused('const path = import.meta.resolve("./user.fixtures.js");', 'reach'),
        refused('import msw = require("msw");', 'reach'),
        refused('type User = import("./user.fixtures.js").User;', 'reach'),
        // An alias that resolves to test material.
        refused('import { users } from "@test-data/users";', 'reach'),
        refused('import { users } from "#fixtures/users.js";', 'reach'),
        // A path the module builds from where it sits, or reads.
        refused('const rows = new URL("./fixtures/rows.json", import.meta.url);', 'pathRead'),
        refused('const rows = new URL("../../specs/fixtures/", import.meta.url);', 'pathRead'),
        refused('const rows = readFileSync("./specs/fixtures/rows.json", "utf8");', 'pathRead'),
        refused('const app = readFileSync("./specs/api/app.ts", "utf8");', 'pathRead'),
        refused(
            'const rows = readFileSync(join(import.meta.dirname, "fixtures", "rows.json"));',
            'pathRead',
        ),
        refused(
            'const here = dirname(fileURLToPath(import.meta.url));\nconst all = readdirSync(join(here, "..", "seeds", name));',
            'pathRead',
        ),
        refused(`const golden = \`\${__dirname}/expected/out.txt\`;`, 'pathRead'),
        // A reach through a module that is not production: the barrel re-exports it.
        refused('export * from "../testing/render.js";', 'reachThrough', BARREL),
        refused('export { users } from "../testing/data.js";', 'reachThrough', BARREL),
        // `lint/` is production as much as `src/`.
        refused('import { it } from "vitest";', 'reach', join(ROOT, 'lint/rule.ts')),
    ],
    valid: [
        // Prod importing prod — a name that merely contains a ground word included.
        { code: 'import { other } from "./other.js";', filename: PROD },
        { code: 'import { seedsOf } from "./seeds-of.js";', filename: PROD },
        // An alias that resolves to production.
        { code: 'import { other } from "@app/domain/other";', filename: PROD },
        { code: 'import { other } from "#domain/other.js";', filename: PROD },
        // A folder named `contracts/` with no facade is not a contracts folder.
        { code: 'import { engine } from "../model/contracts/engine.js";', filename: PROD },
        // A production module on the way is judged for itself: the barrel is
        // Clean, the helper that imports the fixtures is where the finding is.
        { code: 'export * from "./domain/helpers.js";', filename: BARREL },
        // A module that is not production and reaches nothing.
        { code: 'export * from "../testing/format.js";', filename: BARREL },
        // A path built from a root the caller hands in is not the module's own tree.
        { code: 'const all = readdirSync(join(root, "fixtures"));', filename: PROD },
        { code: 'const asset = new URL("./assets/logo.png", import.meta.url);', filename: PROD },
        { code: 'const config = readFileSync("./config.json", "utf8");', filename: PROD },
        // A test reads its ground, and imports test artefacts freely.
        {
            code: 'import rows from "./fixtures/rows.js";',
            filename: join(ROOT, 'src/user.test.ts'),
        },
        { code: 'import { mockOf } from "@jterrazz/test";', filename: join(ROOT, 'src/a.test.ts') },
        { code: 'import { expectTypeOf } from "vitest";', filename: join(ROOT, 'src/a.test-d.ts') },
        {
            code: 'import { specification } from "@jterrazz/test";',
            filename: join(ROOT, 'specs/setup/api.specification.ts'),
        },
        // Outside `src/` and `lint/` is not production: a tool config, a script.
        {
            code: 'import { defineConfig } from "vitest/config";',
            filename: join(ROOT, 'vitest.config.ts'),
        },
        { code: 'import { expect } from "vitest";', filename: join(ROOT, 'scripts/seed.ts') },
        // The tool-facing, zero-runtime lint entry is exempt even from prod code
        // (a shared oxlint preset imports it to wire the plugin — F1/F2).
        { code: 'import { testing } from "@jterrazz/test/oxlint";', filename: PROD },
    ],
});
