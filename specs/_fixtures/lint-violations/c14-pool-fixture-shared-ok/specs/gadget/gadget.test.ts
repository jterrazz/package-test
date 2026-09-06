import { expect, test } from 'vitest';

import { cli } from '../setup.specification.js';

test('renders the gadget', async () => {
    // Given - the same shared stub, read from a second leaf
    const result = await cli.fixture('$FIXTURES/shared-stub/').exec('gadget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
