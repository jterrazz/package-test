import { http } from '@jterrazz/test/stubs';
import { describe, expect, test } from 'vitest';

import { api, PING_URL } from '../intercepts.specification.js';

describe('empty', () => {
    test('a body-less stub reply reaches the app as its status and headers, with no body', async () => {
        // Given - a provider answering 204 with no body
        const result = await api.intercept(http.get(PING_URL), http.empty()).get('/ping');

        // Then - the app read the 204, an empty body, and a reply no cache may serve again
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"body": "", "cacheControl": "no-store", "status": 204}
        `);
    });
});
