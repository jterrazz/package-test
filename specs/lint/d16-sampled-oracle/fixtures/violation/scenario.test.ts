import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('compares the subject with a second reading of the clock', () => {
    // Given - a scenario
    const value = scenario();
    // Then - the oracle samples the machine
    expect(value).toBe(Date.now());
});
