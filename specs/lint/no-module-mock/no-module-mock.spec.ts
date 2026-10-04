import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-module-mock', () => {
    test('accepts an allow-listed module with its reason', async () => {
        // Given - the allow-listed tree
        const result = await lint
            .rules({
                'jterrazz/no-module-mock': [
                    'error',
                    {
                        modules: [
                            {
                                module: '@react-native-async-storage/async-storage',
                                reason: 'a native module no consumer can inject',
                            },
                        ],
                    },
                ],
            })
            .fixture(directory('./_fixtures/allow-listed/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('accepts code-only module tests', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an allow-list entry with no reason', async () => {
        // Given - the allow-listed tree
        const result = await lint
            .rules({
                'jterrazz/no-module-mock': [
                    'error',
                    {
                        modules: [
                            { module: '@react-native-async-storage/async-storage', reason: '' },
                        ],
                    },
                ],
            })
            .fixture(directory('./_fixtures/allow-listed/'))
            .run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/storage.test.ts:5:1  jterrazz(no-module-mock)
                found: "@react-native-async-storage/async-storage" is on the \`modules\` allow-list with no reason
                why: A test doubles a PORT, never a module: \`vi.mock\`/\`vi.doMock\` of a specifier outside the \`modules\` allow-list — each entry \`{ module, reason }\`, and an entry with no reason clears nothing — a \`__mocks__/\` or \`__fixtures__/\` directory, and — in a \`module\`-role test — importing a data asset (\`.json\`, \`.sql\`, \`.yaml\`, …) are all errors.
                fix: state why no consumer can inject it: \`{ module: '@react-native-async-storage/async-storage', reason: '<why>' }\`
                read: docs/reference/linting.md#no-module-mock
        `);
    });

    test('rejects vi.mock and data-asset imports under src/', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/util.test.ts:3:21  jterrazz(no-module-mock)
                found: a module test imports the data asset "./payload.json"
                why: A test doubles a PORT, never a module: \`vi.mock\`/\`vi.doMock\` of a specifier outside the \`modules\` allow-list — each entry \`{ module, reason }\`, and an entry with no reason clears nothing — a \`__mocks__/\` or \`__fixtures__/\` directory, and — in a \`module\`-role test — importing a data asset (\`.json\`, \`.sql\`, \`.yaml\`, …) are all errors.
                fix: write the data as code in a sibling \`<file>.fixtures.ts\`, or move the test under \`specs/\` as a \`.spec.ts\`
                read: docs/reference/linting.md#no-module-mock
            src/util.test.ts:5:1  jterrazz(no-module-mock)
                found: \`vi.mock\` doubles a module for every importer
                why: A test doubles a PORT, never a module: \`vi.mock\`/\`vi.doMock\` of a specifier outside the \`modules\` allow-list — each entry \`{ module, reason }\`, and an entry with no reason clears nothing — a \`__mocks__/\` or \`__fixtures__/\` directory, and — in a \`module\`-role test — importing a data asset (\`.json\`, \`.sql\`, \`.yaml\`, …) are all errors.
                fix: double the port instead — \`mockOf<Port>()\`, \`vi.fn()\`, \`vi.spyOn\` — or put a native module no consumer can inject on the \`modules\` allow-list: \`{ module, reason }\`
                read: docs/reference/linting.md#no-module-mock
            src/util.test.ts:8:1  jterrazz(no-existence-only-assertion)
                found: \`toBeDefined()\` is this test's only oracle, and passes for almost anything
                why: A test whose ONE assertion is an existence check (\`toBeDefined\`, \`not.toBeNull\`, \`not.toBeUndefined\` or a bare \`toHaveBeenCalled\`) is an error.
                fix: assert the value itself — \`toBe\`/\`toStrictEqual\`, the whole result with \`toMatch\`, or the rows
                read: docs/reference/linting.md#no-existence-only-assertion
        `);
    });
});
