import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { cli } from '../cli.specification.js';

test('writes the report', async () => {
    // Given - one report run
    const result = await cli.exec('report');

    // Then - the summary is the golden
    expect(result.stdout).toMatch(file('./expected/summary.txt')); // checker-disable-line c28 -- an input tree of the checker spec: its file form is what the rule reads
});
