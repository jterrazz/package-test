import { describe, expect, test } from 'vitest';

describe('scenario', () => {
test('checks the table without awaiting', async () => {
    // Given - seeded rows
    const rows = getRows();

    // Then - the IO matcher is never awaited (`io-matcher-awaited`)
    expect(rows).toMatch([[1, 'Ada']]);
});
});
