import { directory, file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('names ground that is not there', async () => {
    // Given - a fixture tree that was never committed
    const result = await cli.fixture(directory('./fixtures/shop/')).exec('build');

    // Then - a golden named as a file where a directory stands
    await expect(result.directory('out')).toMatch(directory('./expected/out/'));
    expect(result.stdout).toMatch(file('./expected/out'));
});
