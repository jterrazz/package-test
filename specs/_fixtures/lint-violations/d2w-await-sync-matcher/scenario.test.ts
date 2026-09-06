import { expect, test } from 'vitest';

test('awaits a synchronous matcher', async () => {
    // Given - a computed value
    const value = compute();

    // Then - awaiting toBe is redundant (D2 warn)
    await expect(value).toBe(42);
});
