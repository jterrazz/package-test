import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-status-only-test', () => {
    test('rejects a test whose only assertion is a status probe', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/events/events.test.ts:4:1  jterrazz(no-status-only-test)
                found: the test's only assertions probe the HTTP status
                why: A test whose ONLY assertions are HTTP status probes (\`expect(X.status).toBe(N)\` / \`.toEqual(N)\`, N a numeric literal 100–599) → error: this case wants a full golden (\`expect(result.response).toMatch(file('./_expected/case.http'))\`).
                fix: compare the whole response, \`\`expect(result.response).toMatch(\`HTTP/1.1 …\`)\`\` (\`TEST_UPDATE=1\` fills an empty one), and keep the status probe beside it only if the status is the point
                read: docs/reference/linting.md#no-status-only-test
        `);
    });

    test('stays silent on a status probe beside a golden', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
