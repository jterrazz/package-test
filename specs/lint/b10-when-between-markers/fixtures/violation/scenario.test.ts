import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('narrates the action before the setup', () => {
    // When - the scenario runs
    // Given - a scenario
    const value = scenario();
    // Then - it names itself
    expect(value).toBe('scenario');
});

test('narrates the action after the outcome', () => {
    // Given - a scenario
    const value = scenario();
    // Then - it names itself
    expect(value).toBe('scenario');
    // When - the scenario ran
});
