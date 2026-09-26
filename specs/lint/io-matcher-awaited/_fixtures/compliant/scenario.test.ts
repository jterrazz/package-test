import { describe, expect, test } from 'vitest';

describe('scenario', () => {
test('awaits the io matcher', async () => {
    // Given - seeded rows
    const rows = getRows();

    // Then - the IO matcher is awaited
    await expect(rows).toMatch([[1, 'Ada']]);
});
});
