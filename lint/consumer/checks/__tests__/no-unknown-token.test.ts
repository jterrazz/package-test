import { describe, expect, test } from 'vitest';

import { noUnknownTokenFindings } from '../no-unknown-token.js';

describe('noUnknownTokenFindings', () => {
    test('an unknown token is found on its line, counted from where the text starts', () => {
        // Given - a text starting on line 10, a known token on its first line and an unknown one on its second
        const found = noUnknownTokenFindings('id {{uuid}}\nat {{nope}}\n', 'out.txt', 10);

        // Then - the unknown token, on line 11, told the vocabulary
        expect(found).toStrictEqual([
            {
                fix: 'write one of the tokens the vocabulary has, between double braces: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir',
                found: 'the unknown token {{nope}}',
                line: 11,
                path: 'out.txt',
                rule: 'no-unknown-token',
            },
        ]);
    });
});
