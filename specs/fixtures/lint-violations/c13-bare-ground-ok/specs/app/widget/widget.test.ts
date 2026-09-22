import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { cli } from '../../setup/cli.specification.js';

test('prints the widget listing', async () => {
    // Given - the listing command
    const result = await cli.exec('widget list');

    // Then - the golden matches
    expect(result.stdout).toMatch(file('./expected/out.txt'));
});
