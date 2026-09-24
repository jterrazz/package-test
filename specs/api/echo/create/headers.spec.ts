import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('headers', () => {
    test('a view made with() sends its headers on every chain, and a chain own headers win', async () => {
        // Given - the header a whole file shares, then two chains of it and one overriding it
        const tagged = api.with({ headers: { 'x-chain': 'file' } });
        const first = await tagged.post('/echo', { greeting: 'first' });
        const second = await tagged.post('/echo', { greeting: 'second' });
        const own = await tagged.headers({ 'x-chain': 'own' }).post('/echo', { greeting: 'own' });

        // Then - both chains carry the shared header, and the chain's own replaces it
        expect(first.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"body": {"greeting": "first"}, "headers": {"x-chain": "file", "x-file": null}}
        `);
        expect(second.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"body": {"greeting": "second"}, "headers": {"x-chain": "file", "x-file": null}}
        `);
        expect(own.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"body": {"greeting": "own"}, "headers": {"x-chain": "own", "x-file": null}}
        `);
    });
});
