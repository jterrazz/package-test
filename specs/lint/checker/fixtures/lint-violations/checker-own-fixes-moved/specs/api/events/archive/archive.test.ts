import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('archive', () => {
    test('lists the archive', async () => {
        // Given - the calendar the file reads
        const result = await api.clock('2026-03-04T09:30:00Z').get('/archive');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('lists the archive of a year', async () => {
        // Given - the same calendar
        const result = await api.clock('2026-03-04T09:30:00Z').get('/archive?year=2025');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });
});
