import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('keeps each marker to one sentence', () => {
    // Given - a scenario built by its factory
    const value = scenario();
    // Then - it names itself
    expect(value).toBe('scenario');
});

test('separates an ordinary note with a blank line', () => {
    // Given - a scenario

    // the factory takes no argument
    const value = scenario();
    // Then - it names itself
    expect(value).toBe('scenario');
});
