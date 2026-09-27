import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('stub-data-has-a-builder', () => {
    test('accepts request data paired with its stub, the payload in _fixtures/', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects request data in a kind folder with no stub beside it', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/_setup/stubs/http/articles.request.ts:1:1  jterrazz(stub-data-has-a-builder)
                found: \`_setup/stubs/http/articles.request.ts\` has no stub beside it
                why: Inside a kind folder of \`_setup/stubs/\`, every \`*.request.ts\` — the exact request a unit matches — has a \`<stem>.ts\` sibling, the stem the name up to the FIRST dot (\`classify-article.request.ts\` → \`classify-article.ts\`).
                fix: write \`_setup/stubs/http/articles.ts\` — the data pairs with the unit named by its stem, up to the first dot — or delete the orphan
                read: docs/19-linting.md#stub-data-has-a-builder
            specs/app/widget/widget.test.ts:7:1  jterrazz(no-status-only-test)
                found: the test's only assertions probe the HTTP status
                why: A test whose ONLY assertions are HTTP status probes (\`expect(X.status).toBe(N)\` / \`.toEqual(N)\`, N a numeric literal 100–599) → error: this case wants a full golden (\`expect(result.response).toMatch(file('./_expected/case.http'))\`).
                fix: compare the whole response, \`\`expect(result.response).toMatch(\`HTTP/1.1 …\`)\`\` (\`TEST_UPDATE=1\` fills an empty one), and keep the status probe beside it only if the status is the point
                read: docs/19-linting.md#no-status-only-test
        `);
    });
});
