import { expect, test } from 'vitest';
import { directory, file } from '@jterrazz/test';

import { cli } from '../../setup/runner.specification.js';

test('prints help and scaffolds a tree', async () => {
    // Given - the CLI
    const result = await cli.exec('help');

    // Then - stream fixture carries its extension; tree snapshots are directories
    expect(result.stdout).toMatch(file('./expected/help.txt')); // checker-disable-line c28 -- an input tree of the c6-tomatch-extension spec: its file form is what the rule reads
    await expect(result.directory('out')).toMatch(directory('./expected/tree/'));
});
