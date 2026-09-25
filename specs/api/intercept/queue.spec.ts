import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { api, QUOTES_URL } from '../intercepts.specification.js';

describe('queue', () => {
    test('a finite stub plays before the unlimited tail (retry path)', async () => {
        // Given - a rate-limit allowed exactly once, then a success with no times (unlimited), passed as one list, and an app that retries on 429
        const result = await api
            .intercept([
                { request: http.get(QUOTES_URL), response: http.error(429), times: 1 },
                { request: http.get(QUOTES_URL), response: http.json({ quote: 'after retry' }) },
            ])
            .get('/quote');

        // Then - the retry was served by the tail stub
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "quote": "after retry"
            }
        `);
    });

    test('a path-form url matches the call whatever its origin', async () => {
        // Given - the route declared as a path, not an absolute URL
        const result = await api
            .intercept(http.get('/api/quote'), http.json({ quote: 'by path' }))
            .get('/quote');

        // Then - the origin was ignored and the stub served the call
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "quote": "by path"
            }
        `);
    });
});
