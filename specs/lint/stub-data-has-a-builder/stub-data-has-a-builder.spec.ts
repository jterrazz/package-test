import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('stub-data-has-a-builder', () => {
    test('accepts request data paired with its stub, the payload in __fixtures__/', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects request data in a kind folder with no stub beside it', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/__setup__/stubs/http/articles.request.ts:1:1  jterrazz(stub-data-has-a-builder)
                found: \`__setup__/stubs/http/articles.request.ts\` has no stub beside it
                why: Inside a kind folder of \`__setup__/stubs/\`, every \`*.request.ts\` (the exact request a unit matches) has a \`<stem>.ts\` sibling, the stem the name up to the FIRST dot (\`classify-article.ts\` for \`classify-article.request.ts\`).
                fix: write \`__setup__/stubs/http/articles.ts\` (the data pairs with the unit named by its stem, up to the first dot), or delete the orphan
                read: docs/reference/linting.md#stub-data-has-a-builder
            specs/app/widget/widget.test.ts:7:1  jterrazz(no-status-only-test)
                found: the test's only assertions probe the HTTP status
                why: A test whose ONLY assertions are HTTP status probes (\`expect(X.status).toBe(N)\` / \`.toEqual(N)\`, N a numeric literal from 100 to 599) is an error: this case wants a full golden (\`expect(result.response).toMatch(file('./__expected__/case.http'))\`).
                fix: compare the whole response, \`\`expect(result.response).toMatch(\`HTTP/1.1 ...\`)\`\` (\`TEST_UPDATE=1\` fills an empty one), and keep the status probe beside it only if the status is the point
                read: docs/reference/linting.md#no-status-only-test
        `);
    });
});
