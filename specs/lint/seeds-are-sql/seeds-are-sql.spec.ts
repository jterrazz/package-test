import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('seeds-are-sql', () => {
    test('accepts a _seeds/ directory of .sql fragments only', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a non-.sql file under _seeds/', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:1:1  jterrazz(seeds-are-sql)
                found: \`_seeds/state.json\` is not a \`.sql\` file
                why: \`_seeds/\` holds \`*.sql\` files only; any other file is an error.
                fix: move it to \`_fixtures/\` and lay it with \`.fixture(file(…))\`; \`_seeds/\` holds database state only
                read: docs/24-linting.md#seeds-are-sql
            specs/app/widget/widget.test.ts:7:1  jterrazz(no-status-only-test)
                found: the test's only assertions probe the HTTP status
                why: A test whose ONLY assertions are HTTP status probes (\`expect(X.status).toBe(N)\` / \`.toEqual(N)\`, N a numeric literal 100–599) → error: this case wants a full golden (\`expect(result.response).toMatch(file('./_expected/case.http'))\`).
                fix: compare the whole response, \`\`expect(result.response).toMatch(\`HTTP/1.1 …\`)\`\` (\`TEST_UPDATE=1\` fills an empty one), and keep the status probe beside it only if the status is the point
                read: docs/24-linting.md#no-status-only-test
        `);
    });
});
