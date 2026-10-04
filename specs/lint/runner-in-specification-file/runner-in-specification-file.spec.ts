import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('runner-in-specification-file', () => {
    test('accepts the same runner created in a *.specification.ts file', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a specification.cli() call outside a *.specification.ts file', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/_setup/runner.ts:3:39  jterrazz(runner-in-specification-file)
                found: \`specification.cli()\` called outside a \`*.specification.ts\` file
                why: A runner is created only in a \`*.specification.ts(x)\` file under \`specs/\`: calling \`specification.*\` anywhere else is an error.
                fix: move the call into \`specs/cli/cli.specification.ts\` and import the handle it exports
                read: docs/reference/linting.md#runner-in-specification-file
        `);
    });
});
