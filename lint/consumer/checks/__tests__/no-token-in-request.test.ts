import { describe, expect, test } from 'vitest';

import { noTokenInRequestFindings } from '../no-token-in-request.js';

describe('noTokenInRequestFindings', () => {
    test('a token a request file holds is found on its line, an unknown one is no token', () => {
        // Given - a request holding a known token on its second line and an unknown one on its third
        const found = noTokenInRequestFindings(
            '__requests__/create.http',
            'POST /users\nid: {{uuid}}\nx: {{nope}}\n',
        );

        // Then - the known token alone
        expect(found).toStrictEqual([
            {
                fix: 'write the literal value the request sends — a request is sent, never matched',
                found: 'the token {{uuid}} in a __requests__/ file',
                line: 2,
                path: '__requests__/create.http',
                rule: 'no-token-in-request',
            },
        ]);
    });
});
