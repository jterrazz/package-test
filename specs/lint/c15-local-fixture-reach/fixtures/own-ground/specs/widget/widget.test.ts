import { expect, test } from 'vitest';
import { directory } from '@jterrazz/test';

import { cli } from '../setup.specification.js';

test('renders the widget', async () => {
    // Given - the widget's own ground, beside it
    const result = await cli.fixture(directory('./fixtures/widget-stub/')).exec('widget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
