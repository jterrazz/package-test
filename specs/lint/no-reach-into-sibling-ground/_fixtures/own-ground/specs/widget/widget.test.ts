import { describe, expect, test } from 'vitest';
import { directory } from '@jterrazz/test';

import { cli } from '../setup.specification.js';

describe('widget', () => {
test('renders the widget', async () => {
    // Given - the widget's own ground, beside it
    const result = await cli.fixture(directory('./_fixtures/widget-stub/')).exec('widget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
});
