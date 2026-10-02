import { http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api, QUOTES_URL } from '../intercepts.specification.js';

describe('never', () => {
    test('a never stub the action does not reach lets the chain pass', async () => {
        // Given - the read declared, the write to the same provider declared never requested
        const result = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'read only' }))
            .intercept(http.never(http.post(QUOTES_URL)))
            .get('/quote');

        // Then - the action made the read alone, and nothing is refused
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "quote": "read only"
            }
        `);
    });

    test('a never stub the action reaches rejects it, naming the route and the call, even beside a stub that would answer', async () => {
        // Given - the POST declared never requested, before a stub that would have answered it
        const chain = api
            .intercept(http.never(http.post(QUOTES_URL)))
            .intercept(http.post(QUOTES_URL), http.json({ quote: 'answered' }))
            .get('/submit');

        // Then - the call that happened is the failure, read by its route and its url
        await expect(chain).rejects.toThrow(
            'found: a route the chain declared never requested was reached:',
        );
        await expect(chain).rejects.toThrow(
            `- POST ${QUOTES_URL} — reached by POST ${QUOTES_URL}?lang=en`,
        );
    });
});
