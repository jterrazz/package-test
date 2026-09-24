import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { api as app } from '../api.specification.js';

describe('declared', () => {
    test('the outgoing call is answered by the contract the chain declares', async () => {
        // Given - the one call the app makes out, answered in place
        const result = await app
            .intercept(
                http.get('https://enrich.example.test/label'),
                http.json({ label: 'enriched' }),
            )
            .get('/label');

        // Then - the app served what the contract answered
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"label": "enriched"}
        `);
    });
});
