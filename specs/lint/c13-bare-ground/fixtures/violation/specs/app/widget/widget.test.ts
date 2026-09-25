import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../../setup/cli.specification.js';

describe('widget', () => {
test('prints the widget listing', async () => {
    // Given - the listing command
    const result = await cli.exec('widget list');

    // Then - the golden matches
    expect(result.stdout).toMatch(file('./_expected/out.txt'));
});
});
