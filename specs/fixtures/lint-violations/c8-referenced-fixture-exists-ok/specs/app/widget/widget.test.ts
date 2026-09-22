import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { cli } from '../../setup/runner.specification.js';

test('matches an existing snapshot', async () => {
    // Given - the CLI
    const result = await cli.exec('help');

    // Then - the referenced fixture exists under expected/
    expect(result.stdout).toMatch(file('./expected/help.txt'));
});
