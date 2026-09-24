// checker-disable-next-line c35 -- VISION.md names this path until its batch notes are folded into the chapters
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('headers', () => {
    test("a view made with() sends its headers on every chain, and a chain's own headers win for that chain alone", async () => {
        // Given - the header a whole file shares, two chains of it, one overriding it, then one more chain of it
        const tagged = api.with({ headers: { 'x-chain': 'file' } });
        const first = await tagged.post('/echo', { greeting: 'first' });
        const second = await tagged.post('/echo', { greeting: 'second' });
        const own = await tagged.headers({ 'x-chain': 'own' }).post('/echo', { greeting: 'own' });
        const after = await tagged.post('/echo', { greeting: 'after' });

        // Then - every chain of the view carries the shared header, and the chain's own replaces it on that chain alone
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
        expect(after.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"body": {"greeting": "after"}, "headers": {"x-chain": "file", "x-file": null}}
        `);
    });
});
