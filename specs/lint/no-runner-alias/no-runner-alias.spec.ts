import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('no-runner-alias', () => {
    test('accepts the canonical destructured names', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects destructuring the runner with an alias', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/alias.specification.ts:5:25  jterrazz(no-runner-alias)
                found: \`{ cli: myCli }\` renames the handle
                why: The return is destructured under the constructor's canonical name, unaliased (\`{ api, cleanup, docker }\`); renaming (\`{ api: myApi }\`) is an error.
                fix: destructure \`{ cli }\`, and rename at the import site if a local name must differ
                read: docs/19-linting.md#no-runner-alias
        `);
    });
});
