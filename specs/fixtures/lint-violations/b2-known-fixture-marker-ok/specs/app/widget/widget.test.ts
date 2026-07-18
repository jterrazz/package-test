import { expect, test } from 'vitest';

import { cli } from '../../setup/runner.specification.js';

test('runs against a shared project', async () => {
    // Given - a shared project fixture
    const result = await cli.fixture('$FIXTURES/app/').exec('run');

    // Then - it succeeds
    expect(result.exitCode).toBe(0);
});
