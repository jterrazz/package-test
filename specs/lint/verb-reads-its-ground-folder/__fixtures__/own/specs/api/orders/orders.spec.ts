import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

describe('orders', () => {
test('stands on ground from the folders its verbs read', async () => {
    // Given - a seed among the seeds, a body among the requests
    const result = await api.seed(file('./__seeds__/rows.sql')).post('/orders', file('./__requests__/order.json'));

    // Then - a golden among the expected
    expect(result.response).toMatch(file('./__expected__/created.http'));
});
});
