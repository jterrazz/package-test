import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('d4b-http-first-line', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a requests/*.http without a request line', async () => {
        // Given - a request fixture whose first line is not "METHOD /path"
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/d4b-http-first-line/'))
            .exec('.');

        // Then - the checker fails with the full D4b grammar diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/requests/create.http:1:1: error jterrazz-check(d4b): found: the first line of create.http is no request line · why: The first line of a depth-1 \`.http\` follows its grammar: a request line (\`METHOD /path\`) under \`requests/\`, a status line (\`HTTP/1.1 <status>\`) under \`expected/\`. · fix: start create.http with its request line, \`GET /path\` or another method · read: docs/19-linting.md#d4b-http-first-line

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('accepts well-formed request and status lines', async () => {
        // Given - the compliant twin (request line + status line)
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/d4b-http-first-line-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });
});
