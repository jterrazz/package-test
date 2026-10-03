import { describe, expect, test } from 'vitest';

import { noTokenInRequestFindings } from './no-token-in-request.js';

describe('noTokenInRequestFindings', () => {
    test('a token a request file holds is found on its line, an unknown one is no token', () => {
        // Given - a request holding a known token on its second line and an unknown one on its third
        const found = noTokenInRequestFindings(
            '_requests/create.http',
            'POST /users\nid: {{uuid}}\nx: {{nope}}\n',
        );

        // Then - the known token alone
        expect(found).toStrictEqual([
            {
                fix: 'write the literal value the request sends — a request is sent, never matched',
                found: 'the token {{uuid}} in a _requests/ file',
                line: 2,
                path: '_requests/create.http',
                rule: 'no-token-in-request',
            },
        ]);
    });
});
