import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

describe('orders', () => {
test('binds ground from the folders its verbs read', async () => {
    // Given - a seed among the seeds, named once
    const rows = file('./seeds/rows.sql');
    const golden = file('./expected/orders.http');
    const result = await api.seed(rows).get('/orders');

    // Then - a golden among the expected, reached through its binding
    expect(result.response).toMatch(golden);
});
});
