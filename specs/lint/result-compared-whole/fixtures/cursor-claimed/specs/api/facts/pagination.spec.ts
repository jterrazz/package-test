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
test('claims the cursor it carries', async () => {
    // Given - the first page, its cursor sent AND claimed
    const first = await api.get('/facts?limit=2');
    const cursor = nextCursor(first.response);
    const second = await api.get(`/facts?cursor=${cursor}`);

    // Then - the cursor is a claim of its own, and the page it came from is never compared
    expect(cursor).toBe('c2');
    expect(second.response).toMatch(`
        HTTP/1.1 200 OK

        {"items": [{"id": "f3"}], "next_cursor": null, "total": 3}
    `);
});

test('probes the page the cursor brings', async () => {
    // Given - the first page, read only for its cursor
    const first = await api.get('/facts?limit=2');
    const second = await api.get(`/facts?cursor=${nextCursor(first.response)}`);

    // Then - one probe of the page the test claims, and nothing else of it
    expect(second.json.items).toHaveLength(1);
});
});
