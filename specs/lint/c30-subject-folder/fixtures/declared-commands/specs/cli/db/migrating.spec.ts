import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('migrates without writing', async () => {
    // Given - a dry run
    const result = await cli.exec('db migrate --dry-run');

    // Then - the plan
    expect(result.stdout).toMatch(`migrations: 0`);
});
