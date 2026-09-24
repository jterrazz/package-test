import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('pinned', () => {
    test('the app reads the instant the chain pins', async () => {
        // Given - a chain pinned at an instant
        const result = await api.clock('2026-03-04T09:30:00.000Z').get('/session');

        // Then - the session starts at that instant
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "echo": {
                    "sessionId": "{{uuid#session}}"
                },
                "id": "{{uuid#session}}",
                "startedAt": "2026-03-04T09:30:00.000Z",
                "ttl": 3600
            }
        `);
    });

    test('a view made with() pins every chain it starts', async () => {
        // Given - the instant a whole file shares
        const pinned = api.with({ clock: '2026-03-04T09:30:00.000Z' });
        const result = await pinned.get('/session');

        // Then - the session starts at that instant
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "echo": {
                    "sessionId": "{{uuid#session}}"
                },
                "id": "{{uuid#session}}",
                "startedAt": "2026-03-04T09:30:00.000Z",
                "ttl": 3600
            }
        `);
    });

    test('the next chain reads the real calendar again', async () => {
        // Given - a chain that pinned nothing, after one that did
        await api.clock('2026-03-04T09:30:00Z').get('/session');
        const result = await api.get('/session');

        // Then - the whole session, and its stamp moved on: the pin lasted exactly one chain
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "echo": {
                    "sessionId": "{{uuid#session}}"
                },
                "id": "{{uuid#session}}",
                "startedAt": "{{iso8601}}",
                "ttl": 3600
            }
        `);
        expect(result.response.body).not.toMatchObject({
            startedAt: '2026-03-04T09:30:00.000Z',
        });
    });
});
