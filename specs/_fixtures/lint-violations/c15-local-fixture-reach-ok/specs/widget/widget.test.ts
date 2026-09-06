import { expect, test } from 'vitest';

import { cli } from '../setup.specification.js';

test('renders the widget', async () => {
    // Given - the widget's own ground, beside it
    const result = await cli.fixture('widget-stub/').exec('widget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
