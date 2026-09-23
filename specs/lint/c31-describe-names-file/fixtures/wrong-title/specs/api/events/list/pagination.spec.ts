import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('events listing', () => {
test('lists the first page', async () => {
    // Given - the events the app holds
    const result = await api.get('/events');

    // Then - the whole page
    expect(result.response).toMatch(`HTTP/1.1 200 OK`);
});
});
