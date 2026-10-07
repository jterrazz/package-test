import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('trigger-name-in-kebab-case', () => {
    test('accepts a kebab-case job name', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a non-kebab-case job name in .trigger()', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:8:38  jterrazz(trigger-name-in-kebab-case)
                found: the job name "NightlyReport" is not kebab-case
                why: \`.trigger(name)\` takes a stable kebab-case identifier; a non-kebab-case \`name\` is an error.
                fix: rename the job "nightly-report", in the app and in its tests alike
                read: docs/reference/linting.md#trigger-name-in-kebab-case
        `);
    });
});
