import { join } from 'node:path';

import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/** A golden the spec builds from pieces, which is not there. */
const BUILT = join(import.meta.dirname, '_expected', 'gone.txt');

describe('build', () => {
test('names ground that is not there', async () => {
    // Given - a fixture tree that was never committed
    const result = await cli.fixture(directory('./_fixtures/shop/')).exec('build');

    // Then - a golden named as a file where a directory stands
    await expect(result.directory('out')).toMatch(directory('./_expected/out/'));
    expect(result.stdout).toMatch(file('./_expected/out'));
    expect(BUILT).toContain('_expected');
});
});
