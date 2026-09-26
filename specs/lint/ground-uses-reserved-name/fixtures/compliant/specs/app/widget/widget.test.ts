import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { cli } from '../../setup/cli.specification.js';

describe('widget', () => {
test('prints the widget listing', async () => {
    // Given - the listing command
    const result = await cli.exec('widget list');

    // Then - the golden matches
    expect(result.stdout).toMatch(file('./expected/out.txt')); // checker-disable-line ground-shared-or-inline -- an input tree of the ground-uses-reserved-name spec: its file form is what the rule reads
});
});
