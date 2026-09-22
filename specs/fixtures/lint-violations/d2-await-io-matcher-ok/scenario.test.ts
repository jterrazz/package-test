import { expect, test } from 'vitest';

test('awaits the io matcher', async () => {
    // Given - seeded rows
    const rows = getRows();

    // Then - the IO matcher is awaited
    await expect(rows).toMatchRows([{ id: 1 }]);
});
