import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

describe('orders', () => {
test('binds ground from the wrong folders before handing it over', async () => {
    // Given - a seed parked among the fixtures, named once
    const rows = file('./fixtures/rows.sql');
    const golden = file('./requests/orders.http');
    const result = await api.seed(rows).get('/orders');

    // Then - a golden kept among the requests, reached through its binding
    expect(result.response).toMatch(golden);
});
});
