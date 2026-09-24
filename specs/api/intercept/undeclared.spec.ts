import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { api, QUOTES_URL } from '../intercepts.specification.js';

describe('undeclared', () => {
    test('a request no contract was declared for rejects the action', async () => {
        // Given - a contract for the quotes provider only, while the app calls an entirely different host
        const chain = api.intercept(http.get(QUOTES_URL), http.json({})).get('/other');

        // Then - the error names the offending request and the declared routes
        await expect(chain).rejects.toThrow(
            'found: an unmatched outgoing request, GET https://unregistered.spec.test/thing',
        );
        await expect(chain).rejects.toThrow(`- GET ${QUOTES_URL}`);
    });
});
