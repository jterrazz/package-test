import { describe, expect, test } from 'vitest';
import { directory } from '@jterrazz/test';

import { cli } from '../setup.specification.js';

describe('widget', () => {
test('renders the widget', async () => {
    // Given - the stub no other leaf reaches for, which a module test reads too
    const result = await cli.fixture(directory('../_shared/_fixtures/lonely-stub/')).exec('widget');

    // Then - it ran
    expect(result.exitCode).toBe(0);
});
});
