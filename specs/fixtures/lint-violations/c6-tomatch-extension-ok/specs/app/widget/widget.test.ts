import { expect, test } from 'vitest';

import { cli } from '../../setup/runner.specification.js';

test('prints help and scaffolds a tree', async () => {
    // Given - the CLI
    const result = await cli.exec('help');

    // Then - stream fixture carries its extension; tree snapshots are directories
    expect(result.stdout).toMatchFile('./expected/help.txt');
    await expect(result.directory('out')).toMatchDirectory('./expected/tree/');
});
