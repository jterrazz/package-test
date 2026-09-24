import { expect, test } from 'vitest';
import { directory } from '@jterrazz/test';

import { cli } from '../setup.specification.js';

test('renders the widget', async () => {
    // Given - the stub two leaves share
    const result = await cli.fixture(directory('../shared/fixtures/shared-stub/')).exec('widget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
