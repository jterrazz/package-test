import { expect, test } from 'vitest';

import { cli } from '../setup.specification.js';

test('renders the widget', async () => {
    // Given - the stub nobody else reaches for
    const result = await cli.fixture('$FIXTURES/lonely-stub/').exec('widget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
