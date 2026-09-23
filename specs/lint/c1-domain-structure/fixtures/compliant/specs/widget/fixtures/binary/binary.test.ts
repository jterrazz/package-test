import { expect, test } from 'vitest';

import { binaryPath } from './binary.js';

test('names the built binary under the root it is given', () => {
    // Given - a ground module carrying its own unit test, as I2 asks
    const path = binaryPath('/out');

    // Then - the pairing is legal inside ground: it is code, not a spec
    expect(path).toBe('/out/widget');
});
