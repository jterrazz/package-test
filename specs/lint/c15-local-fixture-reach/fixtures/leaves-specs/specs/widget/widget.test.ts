import { expect, test } from 'vitest';
import { directory } from '@jterrazz/test';

import { cli } from '../setup.specification.js';

test('renders the widget', async () => {
    // Given - a reach out of specs/, into the product's own source
    const result = await cli.fixture(directory('../../src/x/')).exec('widget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
