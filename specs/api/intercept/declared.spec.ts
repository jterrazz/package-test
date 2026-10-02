import { http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api as app } from '../api.specification.js';

describe('declared', () => {
    test('the outgoing call is answered by the stub the chain declares', async () => {
        // Given - the one call the app makes out, answered in place
        const result = await app
            .intercept(
                http.get('https://enrich.example.test/label'),
                http.json({ label: 'enriched' }),
            )
            .get('/label');

        // Then - the app served what the stub answered
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"label": "enriched"}
        `);
    });
});
