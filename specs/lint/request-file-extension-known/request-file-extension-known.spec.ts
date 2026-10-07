import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('request-file-extension-known', () => {
    test('accepts a __requests__/ directory holding a .http request and a .json body', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a file under __requests__/ that carries no extension', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:1:1  jterrazz(request-file-extension-known)
                found: \`__requests__/create-user\` carries no extension
                why: \`__requests__/\` holds what a spec SENDS: a whole request as a \`.http\` (\`request()\`), or a body a verb sends (\`post\`/\`put\`/\`patch\` with a \`file()\`) — a \`.json\`, a \`.txt\`, any format the app reads.
                fix: name it by how it is sent — \`__requests__/create-user.http\` for a whole request, \`__requests__/create-user.json\` for a body the app parses, any other extension for a body sent verbatim
                read: docs/reference/linting.md#request-file-extension-known
            specs/app/widget/widget.test.ts:7:1  jterrazz(no-status-only-test)
                found: the test's only assertions probe the HTTP status
                why: A test whose ONLY assertions are HTTP status probes (\`expect(X.status).toBe(N)\` / \`.toEqual(N)\`, N a numeric literal 100–599) → error: this case wants a full golden (\`expect(result.response).toMatch(file('./__expected__/case.http'))\`).
                fix: compare the whole response, \`\`expect(result.response).toMatch(\`HTTP/1.1 …\`)\`\` (\`TEST_UPDATE=1\` fills an empty one), and keep the status probe beside it only if the status is the point
                read: docs/reference/linting.md#no-status-only-test
        `);
    });
});
