import { describe, expect, test } from 'vitest';

import { http } from '../../../../src/index.js';
import { api, QUOTES_URL } from '../../intercepts.specification.js';

describe('body-cancel', () => {
    test('a subject that drops the reply it was served finishes its request', async () => {
        // Given - an error reply with a body, and an app that cancels the body instead of reading it
        const result = await api
            .intercept(http.get(QUOTES_URL), http.error(503, { error: 'the quotes are down' }))
            .get('/cancel');

        // Then - the cancel settled and the app answered with the status it was served
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "status": 503
            }
        `);
    });
});
