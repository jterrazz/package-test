import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { cli } from '../../setup/widget.specification.js';

describe('widget', () => {
    test('matches the expected snapshot', async () => {
        // Given - a run producing output
        const result = await cli.exec('build');

        // Then - it matches the recorded fixture
        expect(result.stdout).toMatch(file('./expected/out.txt')); // checker-disable-line c28 -- an input tree of the checker spec: its file form is what the rule reads
    });
});
