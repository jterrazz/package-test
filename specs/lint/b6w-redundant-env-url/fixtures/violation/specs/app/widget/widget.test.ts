import { expect, test } from 'vitest';

import { cli, db } from '../../setup/db.specification.js';

test('reads the database', async () => {
    // Given - a hand-wired connection URL
    const result = await cli.env({ DATABASE_URL: db.connectionString }).exec('list');

    // Then - it succeeds
    expect(result.exitCode).toBe(0);
});
