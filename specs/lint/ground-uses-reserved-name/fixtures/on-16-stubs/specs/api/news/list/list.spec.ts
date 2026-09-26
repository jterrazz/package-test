import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';
import { newsroom } from './contracts/newsroom.contracts.js';

describe('list', () => {
test('lists the news the provider serves', async () => {
    // Given - the newsroom the provider replies
    const result = await api.intercept(newsroom).get('/news');

    // Then - the list, whole
    expect(result.response).toMatchObject({ status: 200 });
});
});
