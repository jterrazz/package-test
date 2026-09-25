import { describe, expect, test } from 'vitest';
import { directory } from '@jterrazz/test';

import { cli } from '../setup.specification.js';

describe('widget', () => {
test('renders the widget', async () => {
    // Given - a reach into the sibling leaf's ground
    const result = await cli.fixture(directory('../gadget/fixtures/gadget-stub/')).exec('widget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
});
