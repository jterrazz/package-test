import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('writes the report', async () => {
    // Given - one report run
    const result = await cli.exec('report');

    // Then - the summary is the golden
    expect(result.stdout).toMatch('summary.txt');
});
