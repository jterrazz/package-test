import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

test('stands on ground from the folders its verbs read', async () => {
    // Given - a seed among the seeds, a body among the requests
    const result = await api.seed(file('./seeds/rows.sql')).post('/orders', file('./requests/order.json'));

    // Then - a golden among the expected
    expect(result.response).toMatch(file('./expected/created.http'));
});
