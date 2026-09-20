import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

/** The Given, as a function each test calls for itself. */
function aScenario(): string {
    return scenario();
}

test('builds its own Given', () => {
    // Given - a scenario
    const value = aScenario();
    // Then - it names itself
    expect(value).toBe('scenario');
});
