import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('http-first-line-follows-its-grammar', () => {
    test('rejects a __requests__/*.http without a request line', async () => {
        // Given - a request fixture whose first line is not "METHOD /path"
        const result = await checker
            .fixture(directory('./__fixtures__/http-first-line-follows-its-grammar/'))
            .run();

        // Then - the checker fails with the full `document-follows-its-grammar` grammar diagnostic
        expect(result.report).toMatch(`
            specs/widget/__requests__/create.http:1:1  jterrazz-check(http-first-line-follows-its-grammar)
                found: the first line of create.http is no request line
                why: The first line of a depth-1 \`.http\` follows its grammar: a request line (\`METHOD /path\`, or \`METHOD https://host/path\` for a deployment) under \`__requests__/\`, a status line (\`HTTP/1.1 <status>\`, or \`unreachable: <reason>\` for an exchange that never answered) under \`__expected__/\`.
                fix: start create.http with its request line, \`GET /path\`, \`GET https://host/path\` or another method
                read: docs/reference/linting.md#http-first-line-follows-its-grammar
        `);
    });

    test('accepts well-formed request and status lines', async () => {
        // Given - the compliant twin (request line + status line)
        const result = await checker
            .fixture(directory('./__fixtures__/http-first-line-follows-its-grammar-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
