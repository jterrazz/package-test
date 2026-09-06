import { expect, test } from 'vitest';

import { cli } from '../setup.specification.js';

test('renders the widget', async () => {
    // Given - a reach into the sibling leaf's ground
    const result = await cli.fixture('../gadget/_fixtures/gadget-stub/').exec('widget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
