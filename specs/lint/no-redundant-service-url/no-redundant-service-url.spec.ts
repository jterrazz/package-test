import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-redundant-service-url', () => {
    test('rejects a hand-wired DATABASE_URL from connectionString', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:8:36  jterrazz(no-redundant-service-url)
                found: \`.env({ DATABASE_URL: ….connectionString })\` restates what the framework injects
                why: \`.env({ <SERVICE>_URL: ….connectionString })\` repeats the framework's own injection → error.
                fix: delete the \`DATABASE_URL\` entry — the service record key already injects \`<KEY>_URL\`, and \`DATABASE_URL\`/\`REDIS_URL\` when unambiguous
                read: docs/24-linting.md#no-redundant-service-url
        `);
    });

    test('stays silent for non-URL env variables', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
