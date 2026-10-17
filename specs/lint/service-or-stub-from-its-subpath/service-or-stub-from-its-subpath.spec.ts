import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('service-or-stub-from-its-subpath', () => {
    test('a service and a stub imported from their subpaths pass', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a service and a stub imported from the root are each refused at the name', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/api.specification.ts:1:10  jterrazz(service-or-stub-from-its-subpath)
                found: \`http\` is imported from the root, \`@jterrazz/test\`
                why: A service or a stub is imported from its subpath, never from the root: \`postgres\`, \`redis\`, \`sqlite\`, \`process\`, \`ProcessHandle\` and the types of a service, a database or a container from \`@jterrazz/test/services\`; \`anthropic\`, \`openai\`, \`http\`, \`defineStub\`, \`defineStubs\`, \`intercept\` and the types of a stub, a filter or an interception from \`@jterrazz/test/stubs\`.
                fix: import it from \`@jterrazz/test/stubs\`; \`typescript fix\` moves the import
                read: docs/reference/linting.md#service-or-stub-from-its-subpath
            specs/api/api.specification.ts:1:16  jterrazz(service-or-stub-from-its-subpath)
                found: \`postgres\` is imported from the root, \`@jterrazz/test\`
                why: A service or a stub is imported from its subpath, never from the root: \`postgres\`, \`redis\`, \`sqlite\`, \`process\`, \`ProcessHandle\` and the types of a service, a database or a container from \`@jterrazz/test/services\`; \`anthropic\`, \`openai\`, \`http\`, \`defineStub\`, \`defineStubs\`, \`intercept\` and the types of a stub, a filter or an interception from \`@jterrazz/test/stubs\`.
                fix: import it from \`@jterrazz/test/services\`; \`typescript fix\` moves the import
                read: docs/reference/linting.md#service-or-stub-from-its-subpath
        `);
    });

    test('the fix moves each name to its subpath and keeps the root for the rest', async () => {
        // Given - the violation tree, fixed
        const result = await lint
            .fixture(directory('./__fixtures__/violation/'))
            .run({ fix: true });

        // Then - nothing is left to report, and the imports name their subpaths
        expect(result.report).toMatch('');
        expect(result.file('specs/api/api.specification.ts').content).toBe(
            [
                "import { specification } from '@jterrazz/test';",
                "import { postgres } from '@jterrazz/test/services';",
                "import { http } from '@jterrazz/test/stubs';",
                "import { afterAll } from 'vitest';",
                '',
                'export const { api, cleanup } = await specification.api({',
                "    server: () => ({ request: () => new Response('ok') }),",
                '    services: { db: postgres() },',
                '});',
                '',
                "export const never = http.never(http.get('/admin'));",
                '',
                'afterAll(cleanup);',
                '',
            ].join('\n'),
        );
    });
});
