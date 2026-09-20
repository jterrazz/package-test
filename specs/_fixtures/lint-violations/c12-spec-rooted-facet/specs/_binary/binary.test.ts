import { expect, test } from 'vitest';

import { binary } from './binary.js';

test('names the binary the specs drive', () => {
    // Given
    const path = binary();

    // Then
    expect(path).toBe('./bin/app.sh');
});
