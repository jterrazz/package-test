import { expect, test } from 'vitest';

import { cli } from '../setup.specification.js';

test('renders the gadget', async () => {
    // Given - the gadget's own ground
    const result = await cli.fixture('gadget-stub/').exec('gadget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
