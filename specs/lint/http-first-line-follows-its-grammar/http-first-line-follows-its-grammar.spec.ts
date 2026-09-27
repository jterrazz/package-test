import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('http-first-line-follows-its-grammar', () => {
    test('rejects a _requests/*.http without a request line', async () => {
        // Given - a request fixture whose first line is not "METHOD /path"
        const result = await checker
            .fixture(directory('./_fixtures/http-first-line-follows-its-grammar/'))
            .run();

        // Then - the checker fails with the full `document-follows-its-grammar` grammar diagnostic
        expect(result.report).toMatch(`
            specs/widget/_requests/create.http:1:1  jterrazz-check(http-first-line-follows-its-grammar)
                found: the first line of create.http is no request line
                why: The first line of a depth-1 \`.http\` follows its grammar: a request line (\`METHOD /path\`) under \`_requests/\`, a status line (\`HTTP/1.1 <status>\`) under \`_expected/\`.
                fix: start create.http with its request line, \`GET /path\` or another method
                read: docs/19-linting.md#http-first-line-follows-its-grammar
        `);
    });

    test('accepts well-formed request and status lines', async () => {
        // Given - the compliant twin (request line + status line)
        const result = await checker
            .fixture(directory('./_fixtures/http-first-line-follows-its-grammar-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
