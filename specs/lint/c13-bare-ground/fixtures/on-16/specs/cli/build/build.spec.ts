import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('build', () => {
test('builds', async () => {
    // Given - an empty working directory
    const result = await cli.exec('build');

    // Then - the report, whole
    expect(result.stdout).toMatch('build.txt');
});

test('builds again, the same report', async () => {
    // Given - the same empty working directory
    const result = await cli.exec('build');

    // Then - the same report, whole
    expect(result.stdout).toMatch('build.txt');
});
});
