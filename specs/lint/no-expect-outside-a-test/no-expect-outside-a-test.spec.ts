import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-expect-outside-a-test', () => {
    test('accepts a setup module that returns what it reads', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an assertion in a setup module', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/__setup__/built.ts:4:5  jterrazz(no-expect-outside-a-test)
                found: vitest's \`expect()\` called in a file under \`specs/\` that is no test
                why: Under \`specs/\`, vitest's \`expect\` is called in a test file alone — a \`*.spec.ts\`, a \`*.test.ts(x)\`, a \`*.test-d.ts\`: a \`__setup__/\` module, a test adapter, a stub or a \`*.specification.ts\` that asserts is refused at the call.
                fix: return what the module reads, and assert it in the test that calls it
                read: docs/reference/linting.md#no-expect-outside-a-test
        `);
    });
});
