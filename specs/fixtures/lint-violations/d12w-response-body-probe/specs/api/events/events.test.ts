import { expect, test } from 'vitest';

test('probes the response body in a cluster', () => {
    // Given - an API result
    const result = call();

    // Then - a cast plus three field reads: a raw body cluster (D12 warn)
    const body = result.response.body as {
        items: unknown[];
        next_cursor: null;
        total: number;
    };
    expect(body.total).toBe(1);
    expect(body.next_cursor).toBeNull();
    expect(body.items).toHaveLength(2);
});
