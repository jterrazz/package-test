import { directory, file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('names ground that is there', async () => {
    // Given - the committed fixture tree
    const result = await cli.fixture(directory('./fixtures/shop/')).exec('build');

    // Then - the tree and the stream goldens both exist, each of the kind named
    await expect(result.directory('out')).toMatch(directory('./expected/out/'));
    expect(result.stdout).toMatch(file('./expected/build.txt')); // checker-disable-line c28 -- an input tree of the c8-disk-target-exists spec: its file form is what the rule reads
});
