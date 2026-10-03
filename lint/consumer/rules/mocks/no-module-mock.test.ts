import { ruleTester } from '@jterrazz/test';

import { checkoutUnder } from '../../../kit/testing/package-tree.fixtures.js';
import { noModuleMock } from './no-module-mock.js';

const SRC_TEST = '/repo/src/specification/matching/match.test.ts';
const SPEC = '/repo/specs/cli/exec/exec.spec.ts';

const UNDER_MOCKS = checkoutUnder('__mocks__', ['src']);

const STORAGE = {
    module: '@react-native-async-storage/async-storage',
    reason: 'a native module no consumer can inject',
};

ruleTester().run('no-module-mock', noModuleMock, {
    invalid: [
        {
            name: 'Module mocking is banned under src/.',
            code: 'vi.mock("../../../rules/mocks/match.js");',
            errors: [{ column: 0, line: 1, messageId: 'viMock' }],
            filename: SRC_TEST,
        },
        {
            code: 'vi.doMock("./match.js");',
            errors: [{ column: 0, line: 1, messageId: 'viMock' }],
            filename: SRC_TEST,
        },
        {
            name: 'Data assets are code, not files.',
            code: 'import data from "./payload.json";',
            errors: [{ column: 17, line: 1, messageId: 'assetImport' }],
            filename: SRC_TEST,
        },
        {
            code: 'import sql from "./seed.sql";',
            errors: [{ column: 16, line: 1, messageId: 'assetImport' }],
            filename: SRC_TEST,
        },
        {
            code: 'import config from "./compose.test.yaml";',
            errors: [{ column: 19, line: 1, messageId: 'assetImport' }],
            filename: SRC_TEST,
        },
        {
            name: 'A bundler suffix does not launder a data asset.',
            code: 'import raw from "./payload.json?raw";',
            errors: [{ column: 16, line: 1, messageId: 'assetImport' }],
            filename: SRC_TEST,
        },
        {
            name: 'A spec under specs/ is a test too: module mocking is banned there as well — the reach is every test file, not the src/ tree.',
            code: 'vi.mock("../../../rules/mocks/x.js");',
            errors: [{ column: 0, line: 1, messageId: 'viMock' }],
            filename: SPEC,
        },
        {
            name: 'The dynamic-import spelling is the same double, and an allow-list that does not name it does not clear it.',
            code: 'vi.mock(import("./match.js"), () => ({}));',
            errors: [{ column: 0, line: 1, messageId: 'viMock' }],
            filename: SRC_TEST,
        },
        {
            code: 'vi.mock(import("expo-secure-store"), () => ({}));',
            errors: [{ column: 0, line: 1, messageId: 'viMock' }],
            filename: SRC_TEST,
            options: [{ modules: [STORAGE] }],
        },
        {
            code: 'vi.mock("@react-native-async-storage/async-storage", () => ({}));',
            errors: [{ column: 0, line: 1, messageId: 'unreasoned' }],
            filename: SRC_TEST,
            options: [{ modules: [{ ...STORAGE, reason: ' ' }] }],
        },
        {
            code: 'vi.mock(import("@react-native-async-storage/async-storage"), () => ({}));',
            errors: [{ column: 0, line: 1, messageId: 'unreasoned' }],
            filename: SRC_TEST,
            options: [{ modules: [STORAGE.module] }],
        },
        {
            name: 'Banned directories.',
            code: 'export {};',
            errors: [{ column: 0, line: 1, messageId: 'bannedDir' }],
            filename: '/repo/src/specification/__mocks__/match.ts',
        },
        {
            code: 'export {};',
            errors: [{ column: 0, line: 1, messageId: 'bannedDir' }],
            filename: '/repo/src/specification/__fixtures__/data.ts',
        },
    ],
    valid: [
        {
            name: "A `__mocks__` folder above the package is the machine's: the checkout's module is its own code.",
            code: 'export {};',
            filename: `${UNDER_MOCKS}/src/widget.ts`,
        },
        {
            name: 'The sanctioned tools.',
            code: 'const port = mockOf<DatabasePort>();',
            filename: SRC_TEST,
        },
        {
            name: 'Code imports are fine, with or without extension.',
            code: 'import { match } from "./match.js";',
            filename: SRC_TEST,
        },
        { code: 'import { helper } from "./helper";', filename: SRC_TEST },
        {
            name: 'A dotted `<subject>.<role>` module name is CODE, not a data asset.',
            code: 'import { Post } from "../entities/dashboard.post";',
            filename: SRC_TEST,
        },
        { code: 'import { registry } from "@scope/kernel/plugin.registry";', filename: SRC_TEST },
        { code: 'import { schema } from "./user.schema.js";', filename: SRC_TEST },
        { code: 'import { version } from "node:process";', filename: SRC_TEST },
        {
            name: 'Non-test src files may import what `no-test-code-in-production` and the layer map allow — assets are not checked there (only vi.mock and banned dirs apply).',
            code: 'import data from "./payload.json";',
            filename: '/repo/src/specification/config.ts',
        },
        {
            name: "A spec under specs/ reads real files by design: the asset clause is the module role's alone.",
            code: 'import seed from "./_seeds/users.sql";',
            filename: SPEC,
        },
        {
            name: 'The allow-list clears the native module in both spellings, string and dynamic import.',
            code: 'vi.mock("@react-native-async-storage/async-storage", () => ({}));',
            filename: SRC_TEST,
            options: [{ modules: [STORAGE] }],
        },
        {
            code: 'vi.mock(import("@react-native-async-storage/async-storage"), () => ({}));',
            filename: SRC_TEST,
            options: [{ modules: [STORAGE] }],
        },
    ],
});
