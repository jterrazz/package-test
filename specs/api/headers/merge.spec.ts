import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('merge', () => {
    test('headers of different names set by two calls are both sent', async () => {
        // Given - one header per call, each under its own name
        const result = await api
            .headers({ 'x-chain': 'a' })
            .headers({ 'x-file': 'b' })
            .post('/echo', { greeting: 'both' });

        // Then - the request carried the two
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"body": {"greeting": "both"}, "headers": {"x-chain": "a", "x-file": "b"}}
        `);
    });

    test("a chain's own header joins the one its view shares, under another name", async () => {
        // Given - a view sharing one header, and a chain of it adding another
        const result = await api
            .with({ headers: { 'x-file': 'shared' } })
            .headers({ 'x-chain': 'own' })
            .post('/echo', { greeting: 'joined' });

        // Then - the request carried the shared header and the chain's own
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"body": {"greeting": "joined"}, "headers": {"x-chain": "own", "x-file": "shared"}}
        `);
    });
});
