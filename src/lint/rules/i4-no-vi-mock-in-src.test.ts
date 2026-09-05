import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { i4NoViMockInSrc } from './i4-no-vi-mock-in-src.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SRC_TEST = '/repo/src/core/matching/match.test.ts';

ruleTester.run('i4-no-vi-mock-in-src', i4NoViMockInSrc as unknown as OxlintRule, {
    invalid: [
        // Module mocking is banned under src/.
        { code: 'vi.mock("./match.js");', errors: [{ messageId: 'viMock' }], filename: SRC_TEST },
        { code: 'vi.doMock("./match.js");', errors: [{ messageId: 'viMock' }], filename: SRC_TEST },
        // Data assets are code, not files.
        {
            code: 'import data from "./payload.json";',
            errors: [{ messageId: 'assetImport' }],
            filename: SRC_TEST,
        },
        {
            code: 'import sql from "./seed.sql";',
            errors: [{ messageId: 'assetImport' }],
            filename: SRC_TEST,
        },
        {
            code: 'import config from "./compose.test.yaml";',
            errors: [{ messageId: 'assetImport' }],
            filename: SRC_TEST,
        },
        // A bundler suffix does not launder a data asset.
        {
            code: 'import raw from "./payload.json?raw";',
            errors: [{ messageId: 'assetImport' }],
            filename: SRC_TEST,
        },
        // Banned directories.
        {
            code: 'export {};',
            errors: [{ messageId: 'bannedDir' }],
            filename: '/repo/src/core/__mocks__/match.ts',
        },
        {
            code: 'export {};',
            errors: [{ messageId: 'bannedDir' }],
            filename: '/repo/src/core/__fixtures__/data.ts',
        },
    ],
    valid: [
        // The sanctioned tools.
        { code: 'const port = mockOf<DatabasePort>();', filename: SRC_TEST },
        // Code imports are fine, with or without extension.
        { code: 'import { match } from "./match.js";', filename: SRC_TEST },
        { code: 'import { helper } from "./helper";', filename: SRC_TEST },
        // A dotted `<subject>.<role>` module name is CODE, not a data asset.
        { code: 'import { Post } from "../entities/dashboard.post";', filename: SRC_TEST },
        { code: 'import { registry } from "@scope/kernel/plugin.registry";', filename: SRC_TEST },
        { code: 'import { schema } from "./user.schema.js";', filename: SRC_TEST },
        { code: 'import { version } from "node:process";', filename: SRC_TEST },
        // Non-test src files may import what F2/I1 allow — assets are not
        // Checked there (only vi.mock and banned dirs apply).
        { code: 'import data from "./payload.json";', filename: '/repo/src/core/config.ts' },
        // Outside src/ the rule is inert (specs read real files by design).
        { code: 'vi.mock("./x.js");', filename: '/repo/specs/cli/exec/exec.test.ts' },
    ],
});
