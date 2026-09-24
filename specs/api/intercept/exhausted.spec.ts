import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { api, QUOTES_URL } from '../intercepts.specification.js';

describe('exhausted', () => {
    test('a contract with no times keeps serving every call', async () => {
        // Given - ONE contract for a route the app calls twice
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

    // RUNTIME D7 — from the first contract the network is STRICT: an unmatched
    // Request, an exhausted queue included, fails the spec by name.
    test('an exhausted contract rejects the action with method, URL, and the declared list', async () => {
        // Given - a contract allowed exactly once while the app calls twice
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
