import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('narrates the action between the setup and the outcome', () => {
    // Given - a scenario
    // When - it runs
    const value = scenario();
    // Then - it names itself
    expect(value).toBe('scenario');
});

test('leaves the optional marker out when the call is the action', () => {
    // Given - a scenario
    // Then - it names itself
    expect(scenario()).toBe('scenario');
});
