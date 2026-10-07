import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-token-in-request', () => {
    test('refuses a token leaked into a __requests__/ file', async () => {
        // Given - a request body carrying a {{uuid}} token
        const result = await checker
            .fixture(directory('./__fixtures__/no-token-in-request/'))
            .run();

        // Then - the finding, the echoed leaked token covered by {{string}} — a literal {{uuid}} in the golden would itself be read as a placeholder by the token grammar (see `no-unknown-token`).
        expect(result.report).toMatch(`
            specs/widget/__requests__/create.http:4:1  jterrazz-check(no-token-in-request)
                found: the token {{string}} in a __requests__/ file
                why: A known token in a file under \`__requests__/\` → error: requests are inputs, never matched.
                fix: write the literal value the request sends — a request is sent, never matched
                read: docs/reference/linting.md#no-token-in-request
        `);
    });

    test('stays silent when requests carry no tokens', async () => {
        // Given - the compliant twin
        const result = await checker
            .fixture(directory('./__fixtures__/no-token-in-request-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
