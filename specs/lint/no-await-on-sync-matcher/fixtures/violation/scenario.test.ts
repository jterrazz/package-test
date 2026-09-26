import { describe, expect, test } from 'vitest';

describe('scenario', () => {
test('awaits a synchronous matcher', async () => {
    // Given - a computed value
    const value = compute();

    // Then - awaiting toBe is redundant (`io-matcher-awaited` warn)
    await expect(value).toBe(42);
});
});
