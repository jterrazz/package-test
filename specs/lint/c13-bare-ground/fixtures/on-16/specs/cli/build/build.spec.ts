import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('builds', async () => {
    // Given - an empty working directory
    const result = await cli.exec('build');

    // Then - the report, whole
    expect(result.stdout).toMatch('build.txt');
});
