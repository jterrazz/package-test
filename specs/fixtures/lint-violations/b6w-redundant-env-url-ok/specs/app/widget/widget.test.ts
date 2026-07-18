import { expect, test } from 'vitest';

import { cli } from '../../setup/db.specification.js';

test('reads the database', async () => {
    // Given - the injected DATABASE_URL and a custom variable
    const result = await cli.env({ VERBOSE: '1' }).exec('list');

    // Then - it succeeds
    expect(result.exitCode).toBe(0);
});
