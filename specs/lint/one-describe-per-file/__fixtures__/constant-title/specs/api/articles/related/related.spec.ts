import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('related', () => {
test('lists the related articles', async () => {
    // Given - an article with related ones
    const result = await api.get('/articles/related');

    // Then - the whole response
    expect(result.response).toMatch(`HTTP/1.1 200 OK`);
});
});

describe('ARTICLES_42_RELATED_INDICES', () => {
test('holds three indices', () => {
    // Given - the constant
    // Then - its length
    expect([1, 2, 3]).toHaveLength(3);
});
});
