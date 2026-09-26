import { join } from 'node:path';

import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/** A golden the spec builds from pieces, which is there. */
const BUILT = join(import.meta.dirname, 'expected', 'build.txt');

describe('build', () => {
test('names ground that is there', async () => {
    // Given - the committed fixture tree
    const result = await cli.fixture(directory('./fixtures/shop/')).exec('build');

    // Then - the tree and the stream goldens both exist, each of the kind named
    await expect(result.directory('out')).toMatch(directory('./expected/out/'));
    expect(result.stdout).toMatch(file('./expected/build.txt')); // checker-disable-line ground-shared-or-inline -- an input tree of the named-path-exists spec: its file form is what the rule reads
    expect(BUILT).toContain('expected');
});
});
