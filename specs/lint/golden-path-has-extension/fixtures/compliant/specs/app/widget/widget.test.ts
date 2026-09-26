import { describe, expect, test } from 'vitest';
import { directory, file } from '@jterrazz/test';

import { cli } from '../../setup/runner.specification.js';

describe('widget', () => {
test('prints help and scaffolds a tree', async () => {
    // Given - the CLI
    const result = await cli.exec('help');

    // Then - stream fixture carries its extension; tree snapshots are directories
    expect(result.stdout).toMatch(file('./expected/help.txt')); // checker-disable-line ground-shared-or-inline -- an input tree of the golden-path-has-extension spec: its file form is what the rule reads
    await expect(result.directory('out')).toMatch(directory('./expected/tree/'));
});
});
