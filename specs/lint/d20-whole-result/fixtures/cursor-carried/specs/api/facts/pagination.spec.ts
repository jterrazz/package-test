import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

function nextCursor(response: { body: unknown }): string {
    const { body } = response;
    if (typeof body === 'object' && body !== null && 'next_cursor' in body) {
        return String(body.next_cursor);
    }
    throw new Error('Expected the page to carry a next_cursor.');
}

describe('pagination', () => {
test('returns the first page', async () => {
    // Given - three facts
    const result = await api.get('/facts?limit=2');

    // Then - the first page, whole
    expect(result.response).toMatch(`
        HTTP/1.1 200 OK

        {"items": [{"id": "f1"}, {"id": "f2"}], "next_cursor": "c2", "total": 3}
    `);
});

test('follows the cursor to the remaining items', async () => {
    // Given - the first page, read only for the cursor it hands back
    const first = await api.get('/facts?limit=2');
    const cursor = nextCursor(first.response);

    // Then - the cursor brings the remaining item
    const second = await api.get(`/facts?cursor=${cursor}`);
    expect(second.response).toMatch(`
        HTTP/1.1 200 OK

        {"items": [{"id": "f3"}], "next_cursor": null, "total": 3}
    `);
});

test('sends the cursor read in place', async () => {
    // Given - the first page, its cursor sent in the next request's own text
    const first = await api.get('/facts?limit=2');

    // Then - the cursor brings the remaining item
    const second = await api.get(`/facts?cursor=${String(first.json.next_cursor)}`);
    expect(second.response).toMatch(`
        HTTP/1.1 200 OK

        {"items": [{"id": "f3"}], "next_cursor": null, "total": 3}
    `);
});

test('sends the cursor through a request held in a name', async () => {
    // Given - the first page, and the next request built from its cursor
    const first = await api.get('/facts?limit=2');
    const next = api.get(`/facts?cursor=${nextCursor(first.response)}`);

    // Then - the held request, awaited, brings the remaining item
    const second = await next;
    expect(second.response).toMatch(`
        HTTP/1.1 200 OK

        {"items": [{"id": "f3"}], "next_cursor": null, "total": 3}
    `);
});
});
