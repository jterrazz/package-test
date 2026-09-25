import { describe, expect, test } from 'vitest';

import { cli } from '../../cli.specification.js';

describe('manifest', () => {
test('prints the manifest', async () => {
    // Given
    const result = await cli.exec('manifest');

    // Then
    expect(result.exitCode).toBe(0);
});
});
