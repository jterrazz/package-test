import { describe, expect, test } from 'vitest';

import { defineStubs, http } from '../../../src/index.js';
import { api, QUOTES_URL } from '../intercepts.specification.js';
import latestNews from './_setup/stubs/latest-news.stubs.js';

describe('composition', () => {
    test('a stub and an inline pair mix in one chain', async () => {
        // Given - a declared stub plus a one-off inline pair
        const result = await api
            .intercept(latestNews)
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'inline' }))
            .get('/combo');

        // Then - each outgoing call got its declared response
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "news": {
                    "headline": "Stub headline"
                },
                "quote": {
                    "quote": "inline"
                }
            }
        `);
    });

    test('a composite scenario overrides one route of the declared world', async () => {
        // Given - a two-route composite, with the quotes route overridden
        const world = defineStubs(latestNews, {
            request: http.get(QUOTES_URL),
            response: http.json({ quote: 'nominal' }),
        });
        const result = await api
            .intercept(
                world.with({ request: http.get(QUOTES_URL), response: http.json({ quote: 'x' }) }),
            )
            .get('/combo');

        // Then - the override answered, the untouched route still did
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "news": {
                    "headline": "Stub headline"
                },
                "quote": {
                    "quote": "x"
                }
            }
        `);
    });
});
