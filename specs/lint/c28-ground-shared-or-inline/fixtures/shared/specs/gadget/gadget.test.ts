import { expect, test } from 'vitest';
import { directory } from '@jterrazz/test';

import { cli } from '../setup.specification.js';

test('renders the gadget', async () => {
    // Given - the same shared stub, read from a second leaf
    const result = await cli.fixture(directory('../fixtures/shared-stub/')).exec('gadget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
