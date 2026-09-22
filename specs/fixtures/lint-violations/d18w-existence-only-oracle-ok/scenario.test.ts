import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('says what came back', () => {
    // Given - a scenario
    const value = scenario();
    // Then - the value is stated
    expect(value).toBe('scenario');
});
