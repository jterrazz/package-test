import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('api — the chain pins the calendar of the app', () => {
    test('the next chain reads the real calendar again', async () => {
        // Given - a chain that pinned nothing, after one that did
        await api.clock('2026-03-04T09:30:00Z').get('/session');
        const result = await api.get('/session');

        // Then - the stamp moved on: the pin lasted exactly one chain
        expect(result.response.body).not.toMatchObject({
            startedAt: '2026-03-04T09:30:00.000Z',
        });
    });
});
