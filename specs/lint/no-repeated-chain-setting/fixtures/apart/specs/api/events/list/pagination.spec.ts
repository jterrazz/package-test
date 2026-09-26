import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('pagination', () => {
    test('lists the first page', async () => {
        // Given - the calendar the file reads
        const result = await api.clock('2026-03-04T09:30:00Z').get('/events');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('lists the second page', async () => {
        // Given - the same calendar
        const result = await api.clock('2026-03-05T09:30:00Z').get('/events?page=2');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });
});
