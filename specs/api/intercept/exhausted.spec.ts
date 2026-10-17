import { http } from '@jterrazz/test/stubs';
import { describe, expect, test } from 'vitest';

import { api, QUOTES_URL } from '../intercepts.specification.js';

describe('exhausted', () => {
    test('a stub with no times keeps serving every call', async () => {
        // Given - ONE stub for a route the app calls twice
        const result = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'sticky' }))
            .get('/quote-twice');

        // Then - both calls were served (no times = unlimited, no exhaustion)
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "first": 200,
                "second": 200
            }
        `);
    });

    // RUNTIME network-strict-after-first-stub — from the first stub the network is STRICT: an unmatched request, an exhausted queue included, fails the spec by name.
    test('an exhausted stub rejects the action with method, URL, and the declared list', async () => {
        // Given - a stub allowed exactly once while the app calls twice
        const chain = api
            .intercept([
                {
                    request: http.get(QUOTES_URL),
                    response: http.json({ quote: 'only one' }),
                    times: 1,
                },
            ])
            .get('/quote-twice');

        // Then - the spec fails with the offending request and the queue state
        await expect(chain).rejects.toThrow(
            `found: an unmatched outgoing request, GET ${QUOTES_URL}`,
        );
        await expect(chain).rejects.toThrow(`- GET ${QUOTES_URL} (exhausted after 1)`);
    });
});
