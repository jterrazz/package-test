import { expect, test } from 'vitest';

test('checks the table without awaiting', async () => {
    // Given - seeded rows
    const rows = getRows();

    // Then - the IO matcher is never awaited (D2)
    expect(rows).toMatchRows([{ id: 1 }]);
});
