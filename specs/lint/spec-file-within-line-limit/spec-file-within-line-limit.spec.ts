import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('spec-file-within-line-limit', () => {
    test('a spec file under the cap passes', async () => {
        // Given - the short tree
        const result = await lint.fixture(directory('./_fixtures/short/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a spec file over 400 lines is refused at its first line', async () => {
        // Given - the long tree
        const result = await lint.fixture(directory('./_fixtures/long/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/events/list/pagination.spec.ts:1:1  jterrazz(spec-file-within-line-limit)
                found: a spec file of 405 lines, over 400
                why: A spec file holds at most 400 lines; a longer one is refused at its first line, the message grouping its tests by the prefix of their titles — where the cut usually goes.
                fix: cut it along its tests’ groups — "pagination" (50) — one aspect per file
                read: docs/reference/linting.md#spec-file-within-line-limit
        `);
    });
});
