import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('createArticle', () => {
test('createArticle — capitalizes the title', async () => {
    // Given - an article titled in lower case
    const result = await api.post('/articles', { title: 'notes' });

    // Then - the whole response
    expect(result.response).toMatch(`HTTP/1.1 201 Created`);
});

test('trims the body', async () => {
    // Given - an article whose body ends in blanks
    const result = await api.post('/articles', { body: 'text  ' });

    // Then - the whole response
    expect(result.response).toMatch(`HTTP/1.1 201 Created`);
});
});
