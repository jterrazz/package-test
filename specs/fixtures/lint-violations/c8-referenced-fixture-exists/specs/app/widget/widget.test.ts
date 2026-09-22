import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { cli } from '../../setup/runner.specification.js';

test('matches a snapshot that was never created', async () => {
    // Given - the CLI
    const result = await cli.exec('help');

    // Then - the referenced fixture does not exist on disk (C8)
    expect(result.stdout).toMatch(file('./expected/missing.txt'));
});
