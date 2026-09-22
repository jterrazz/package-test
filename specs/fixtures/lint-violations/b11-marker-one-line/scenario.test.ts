import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('wraps its narration onto a second comment line', () => {
    // Given - a scenario, built by a factory whose arguments
    // the reader has to follow across two lines
    const value = scenario();
    // Then - it names itself
    expect(value).toBe('scenario');
});
