import { expect, test } from 'vitest';

test('does not await a synchronous matcher', async () => {
    // Given - a computed value
    const value = compute();

    // Then - the sync matcher is not awaited
    expect(value).toBe(42);
});
