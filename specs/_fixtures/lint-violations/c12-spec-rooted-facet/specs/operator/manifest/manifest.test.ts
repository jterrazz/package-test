import { expect, test } from 'vitest';

import { cli } from '../../cli.specification.js';

test('prints the manifest', async () => {
    // Given
    const result = await cli.exec('manifest');

    // Then
    expect(result.exitCode).toBe(0);
});
