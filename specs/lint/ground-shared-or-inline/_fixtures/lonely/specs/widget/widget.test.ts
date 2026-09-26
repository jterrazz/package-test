import { describe, expect, test } from 'vitest';
import { directory } from '@jterrazz/test';

import { cli } from '../setup.specification.js';

describe('widget', () => {
test('renders the widget', async () => {
    // Given - the stub nobody else reaches for
    const result = await cli.fixture(directory('../_shared/_fixtures/lonely-stub/')).exec('widget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
});
