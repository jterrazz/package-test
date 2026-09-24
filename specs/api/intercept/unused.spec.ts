import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { api, QUOTES_URL } from '../intercepts.specification.js';

describe('unused', () => {
    test('a required contract the app never calls rejects the action', async () => {
        // Given - a contract the spec claims the route MUST call, on an action that never reaches the network
        const chain = api
            .intercept({
                request: http.get(QUOTES_URL),
                response: http.json({ quote: 'never' }),
                required: true,
            })
            .get('/health');

        // Then - the silent omission is the failure, naming the route
        await expect(chain).rejects.toThrow(
            `- GET ${QUOTES_URL} — declared and required but never requested`,
        );
    });

    test('an unused contract from one chain does not leak into the next', async () => {
        // Given - a first chain declaring a contract its action never uses
        const first = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'FIRST' }))
            .get('/health');
        expect(first.status).toBe(200);

        // When - a second chain declares its own contract for the same route
        const second = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'SECOND' }))
            .get('/quote');

        // Then - the second chain served ITS contract, not the leftover
        expect(second.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "quote": "SECOND"
            }
        `);
    });
});
