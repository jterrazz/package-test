import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { checkoutUnder } from '../../rule-tester.fixtures.js';
import { i4NoModuleDoubles } from './i4-no-module-doubles.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: a `LintRule` reads every node as an `AstNode`, where oxlint
// types each handler with its node's interface.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SRC_TEST = '/repo/src/specification/matching/match.test.ts';
const SPEC = '/repo/specs/cli/exec/exec.spec.ts';

/** A package checked out under a folder named `__mocks__/`. */
const UNDER_MOCKS = checkoutUnder('__mocks__', ['src']);

ruleTester.run('i4-no-module-doubles', i4NoModuleDoubles as unknown as OxlintRule, {
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
        // A spec under specs/ is a test too: module mocking is banned there as
        // well — the reach is every test file, not the src/ tree.
        { code: 'vi.mock("./x.js");', errors: [{ messageId: 'viMock' }], filename: SPEC },
        // The dynamic-import spelling is the same double, and an allow-list
        // that does not name it does not clear it.
        {
            code: 'vi.mock(import("./match.js"), () => ({}));',
            errors: [{ messageId: 'viMock' }],
            filename: SRC_TEST,
        },
        {
            code: 'vi.mock(import("expo-secure-store"), () => ({}));',
            errors: [{ messageId: 'viMock' }],
            filename: SRC_TEST,
            options: [{ modules: ['@react-native-async-storage/async-storage'] }],
        },
        // Banned directories.
        {
            code: 'export {};',
            errors: [{ messageId: 'bannedDir' }],
            filename: '/repo/src/specification/__mocks__/match.ts',
        },
        {
            code: 'export {};',
            errors: [{ messageId: 'bannedDir' }],
            filename: '/repo/src/specification/__fixtures__/data.ts',
        },
    ],
    valid: [
        // A `__mocks__` folder above the package is the machine's: the checkout's module is its own code.
        { code: 'export {};', filename: `${UNDER_MOCKS}/src/widget.ts` },
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
        // checked there (only vi.mock and banned dirs apply).
        {
            code: 'import data from "./payload.json";',
            filename: '/repo/src/specification/config.ts',
        },
        // A spec under specs/ reads real files by design — the asset clause is
        // the module role's alone.
        { code: 'import seed from "./seeds/users.sql";', filename: SPEC },
        // The allow-list clears the native module in BOTH spellings: the
        // String one, and the dynamic import `vitest/prefer-import-in-mock`
        // asks for — an allow-listed module has a green spelling under both.
        {
            code: 'vi.mock("@react-native-async-storage/async-storage", () => ({}));',
            filename: SRC_TEST,
            options: [{ modules: ['@react-native-async-storage/async-storage'] }],
        },
        {
            code: 'vi.mock(import("@react-native-async-storage/async-storage"), () => ({}));',
            filename: SRC_TEST,
            options: [{ modules: ['@react-native-async-storage/async-storage'] }],
        },
    ],
});
