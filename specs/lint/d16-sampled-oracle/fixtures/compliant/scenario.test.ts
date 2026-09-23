import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('compares the subject with a pinned value', () => {
    // Given - a scenario
    const value = scenario();
    // Then - the oracle is a literal the test states
    expect(value).toBe('scenario');
});
