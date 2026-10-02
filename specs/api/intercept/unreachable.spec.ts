import { http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api, QUOTES_URL } from '../intercepts.specification.js';

describe('unreachable', () => {
    test('an unreachable stub fails the transport instead of answering', async () => {
        // Given - the provider declared unreachable: no status, no body, no reply
        const result = await api
            .intercept(http.get(QUOTES_URL), http.unreachable())
            .get('/offline');

        // Then - the caller took its "nothing answered" branch, which only a transport failure reaches — `http.error(503)` would reach the other
        expect(result.response).toMatch(`
            HTTP/1.1 503 Service Unavailable
            content-type: application/json

            {
                "error": "the quotes service did not answer"
            }
        `);
    });
});
