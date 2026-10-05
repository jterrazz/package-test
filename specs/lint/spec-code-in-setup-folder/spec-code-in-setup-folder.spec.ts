import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('spec-code-in-setup-folder', () => {
    test('a helper in the _setup/ of the folder its specs share passes', async () => {
        // Given - the in-setup tree
        const result = await checker.fixture(directory('./_fixtures/in-setup/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a helper beside its test, a stub facade and fixtures modules outside _setup/ are refused', async () => {
        // Given - the loose tree
        const result = await checker.fixture(directory('./_fixtures/loose/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/_setup/rows.fixtures.ts:1:1  jterrazz-check(spec-code-in-setup-folder)
                found: \`rows.fixtures.ts\` under specs/: a fixture is input data, a file in \`_fixtures/\`, never a module
                why: Under a specs tree, a module — \`.ts\`, \`.tsx\`, \`.js\`, \`.mjs\` and their kin — that is no spec (\`*.spec.ts\`), no test (\`*.test.ts\`, \`*.test.tsx\`) and no runner (\`*.specification.ts\`) sits under a \`_setup/\`: a test adapter, a shared value, a helper, a stub facade and its kind folders (\`_setup/stubs/\`).
                fix: name the module for what it holds and move it into the \`_setup/\` of the lowest folder its readers share — \`specs/cli/_setup/<meaning>.ts\` — and the paths that import it
                read: docs/reference/linting.md#spec-code-in-setup-folder
            specs/cli/orders/format.test.ts:1:1  jterrazz-check(specification-test-uses-its-runner)
                found: a test under the \`cli\` specification that reaches no runner
                why: A test under \`specs/<specification>/\`, where the specification root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself.
                fix: import \`{ cli }\` from \`cli.specification.js\` and drive the product through it, or move the module test beside its module
                read: docs/reference/linting.md#specification-test-uses-its-runner
            specs/cli/orders/format.ts:1:1  jterrazz-check(spec-code-in-setup-folder)
                found: \`format.ts\`, code that prepares specs outside every \`_setup/\`
                why: Under a specs tree, a module — \`.ts\`, \`.tsx\`, \`.js\`, \`.mjs\` and their kin — that is no spec (\`*.spec.ts\`), no test (\`*.test.ts\`, \`*.test.tsx\`) and no runner (\`*.specification.ts\`) sits under a \`_setup/\`: a test adapter, a shared value, a helper, a stub facade and its kind folders (\`_setup/stubs/\`).
                fix: move it to \`specs/cli/orders/_setup/format.ts\` — the \`_setup/\` of the lowest folder its readers share — and the paths that import it
                read: docs/reference/linting.md#spec-code-in-setup-folder
            specs/cli/orders/orders.fixtures.ts:1:1  jterrazz-check(spec-code-in-setup-folder)
                found: \`orders.fixtures.ts\` under specs/: a fixture is input data, a file in \`_fixtures/\`, never a module
                why: Under a specs tree, a module — \`.ts\`, \`.tsx\`, \`.js\`, \`.mjs\` and their kin — that is no spec (\`*.spec.ts\`), no test (\`*.test.ts\`, \`*.test.tsx\`) and no runner (\`*.specification.ts\`) sits under a \`_setup/\`: a test adapter, a shared value, a helper, a stub facade and its kind folders (\`_setup/stubs/\`).
                fix: name the module for what it holds and move it into the \`_setup/\` of the lowest folder its readers share — \`specs/cli/orders/_setup/<meaning>.ts\` — and the paths that import it
                read: docs/reference/linting.md#spec-code-in-setup-folder
            specs/cli/orders/stubs/catalog.stubs.ts:1:1  jterrazz-check(spec-code-in-setup-folder)
                found: \`catalog.stubs.ts\`, code that prepares specs outside every \`_setup/\`
                why: Under a specs tree, a module — \`.ts\`, \`.tsx\`, \`.js\`, \`.mjs\` and their kin — that is no spec (\`*.spec.ts\`), no test (\`*.test.ts\`, \`*.test.tsx\`) and no runner (\`*.specification.ts\`) sits under a \`_setup/\`: a test adapter, a shared value, a helper, a stub facade and its kind folders (\`_setup/stubs/\`).
                fix: move it to \`specs/cli/orders/_setup/stubs/catalog.stubs.ts\` — the \`_setup/\` of the lowest folder its readers share — and the paths that import it
                read: docs/reference/linting.md#spec-code-in-setup-folder
        `);
    });
});
