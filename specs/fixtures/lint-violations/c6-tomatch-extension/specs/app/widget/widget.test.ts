import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { cli } from '../../setup/runner.specification.js';

test('prints help', async () => {
    // Given - the CLI
    const result = await cli.exec('help');

    // Then - output matches the fixture
    expect(result.stdout).toMatch(file('./expected/help'));
});
