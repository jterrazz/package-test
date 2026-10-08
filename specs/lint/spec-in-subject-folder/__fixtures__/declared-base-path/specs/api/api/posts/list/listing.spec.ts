import { describe, expect, test } from 'vitest';

import { api } from '../../../api.specification.js';

describe('listing', () => {
test('lists the posts', async () => {
    // Given - no post
    const result = await api.get('/api/posts');

    // Then - the whole answer
    expect(result.response).toMatch(`HTTP/1.1 200 OK`);
});
});
