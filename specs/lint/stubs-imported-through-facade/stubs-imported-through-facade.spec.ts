import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('stubs-imported-through-facade', () => {
    test('accepts a test importing the stubs facade', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a test importing an internal unit stub', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:4:19  jterrazz(stubs-imported-through-facade)
                found: the import "./__setup__/stubs/http/events.js" reaches into a stub kind folder
                why: Outside \`specs/**/__setup__/stubs/\`, an import resolving into a kind folder (\`__setup__/stubs/<kind>/...\`, \`<kind>\` a stub builder the package exports: \`http\`, \`openai\`, \`anthropic\`) is an error: a test imports only the \`*.stubs.ts\` facades.
                fix: export a named scenario from the \`__setup__/stubs/*.stubs.ts\` facade, and import that
                read: docs/reference/linting.md#stubs-imported-through-facade
            specs/app/widget/widget.test.ts:7:1  jterrazz(no-status-only-test)
                found: the test's only assertions probe the HTTP status
                why: A test whose ONLY assertions are HTTP status probes (\`expect(X.status).toBe(N)\` / \`.toEqual(N)\`, N a numeric literal from 100 to 599) is an error: this case wants a full golden (\`expect(result.response).toMatch(file('./__expected__/case.http'))\`).
                fix: compare the whole response, \`\`expect(result.response).toMatch(\`HTTP/1.1 ...\`)\`\` (\`TEST_UPDATE=1\` fills an empty one), and keep the status probe beside it only if the status is the point
                read: docs/reference/linting.md#no-status-only-test
        `);
    });
});
