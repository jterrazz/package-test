import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('seeds-are-sql', () => {
    test('accepts a __seeds__/ directory of .sql fragments only', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a non-.sql file under __seeds__/', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:1:1  jterrazz(seeds-are-sql)
                found: \`__seeds__/state.json\` is not a \`.sql\` file
                why: \`__seeds__/\` holds \`*.sql\` files only; any other file is an error.
                fix: move it to \`__fixtures__/\` and lay it with \`.fixture(file(…))\`; \`__seeds__/\` holds database state only
                read: docs/reference/linting.md#seeds-are-sql
            specs/app/widget/widget.test.ts:7:1  jterrazz(no-status-only-test)
                found: the test's only assertions probe the HTTP status
                why: A test whose ONLY assertions are HTTP status probes (\`expect(X.status).toBe(N)\` / \`.toEqual(N)\`, N a numeric literal 100–599) → error: this case wants a full golden (\`expect(result.response).toMatch(file('./__expected__/case.http'))\`).
                fix: compare the whole response, \`\`expect(result.response).toMatch(\`HTTP/1.1 …\`)\`\` (\`TEST_UPDATE=1\` fills an empty one), and keep the status probe beside it only if the status is the point
                read: docs/reference/linting.md#no-status-only-test
        `);
    });
});
