import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

describe('orders', () => {
test('stands on ground from the wrong folders', async () => {
    // Given - a seed parked among the fixtures
    const result = await api.seed(file('./_fixtures/rows.sql')).get('/orders');

    // Then - a golden kept among the requests
    expect(result.response).toMatch(file('./_requests/orders.http'));
});
});
