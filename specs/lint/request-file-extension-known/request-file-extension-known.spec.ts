import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('request-file-extension-known', () => {
    test('accepts a _requests/ directory holding a .http request and a .json body', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a file under _requests/ that carries no extension', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:1:1  jterrazz(request-file-extension-known)
                found: \`_requests/create-user\` carries no extension
                why: \`_requests/\` holds what a spec SENDS: a whole request as a \`.http\` (\`request()\`), or a body a verb sends (\`post\`/\`put\`/\`patch\` with a \`file()\`) — a \`.json\`, a \`.txt\`, any format the app reads.
                fix: name it by how it is sent — \`_requests/create-user.http\` for a whole request, \`_requests/create-user.json\` for a body the app parses, any other extension for a body sent verbatim
                read: docs/19-linting.md#request-file-extension-known
            specs/app/widget/widget.test.ts:7:1  jterrazz(no-status-only-test)
                found: the test's only assertions probe the HTTP status
                why: A test whose ONLY assertions are HTTP status probes (\`expect(X.status).toBe(N)\` / \`.toEqual(N)\`, N a numeric literal 100–599) → error: this case wants a full golden (\`expect(result.response).toMatch(file('./_expected/case.http'))\`).
                fix: compare the whole response, \`\`expect(result.response).toMatch(\`HTTP/1.1 …\`)\`\` (\`TEST_UPDATE=1\` fills an empty one), and keep the status probe beside it only if the status is the point
                read: docs/19-linting.md#no-status-only-test
        `);
    });
});
