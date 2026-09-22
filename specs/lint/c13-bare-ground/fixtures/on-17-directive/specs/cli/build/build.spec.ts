import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

test('builds in colour', async () => {
    // Given - an empty working directory
    const result = await cli.exec('build');

    // Then - the colour codes themselves, and the report whole
    // oxlint-disable-next-line jterrazz/d8w-text-bypass -- asserts the colour codes themselves (a 16 id that no longer exists)
    expect(result.stdout.text).toContain('[31m');
    expect(result.stdout).toMatch(file('./expected/build.txt'));
});
