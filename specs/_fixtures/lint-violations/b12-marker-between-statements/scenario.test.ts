import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('hides a marker inside a declarator chain', () => {
    // Given - a scenario
    const value = scenario(),
        // Then - it names itself
        name = value;
    expect(name).toBe('scenario');
});
