import { describe, expect, test } from 'vitest';
import { directory } from '@jterrazz/test';

import { cli } from '../setup.specification.js';

describe('gadget', () => {
test('renders the gadget', async () => {
    // Given - the gadget's own ground
    const result = await cli.fixture(directory('./_fixtures/gadget-stub/')).exec('gadget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
});
