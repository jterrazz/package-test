import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('listing', () => {
test('lists the data', async () => {
    // Given - no datum
    const result = await api.get('/data');

    // Then - the whole answer
    expect(result.response).toMatch(`HTTP/1.1 200 OK`);
});
});
