import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('keeps every marker between two statements', () => {
    // Given - a scenario
    const value = scenario(),
        name = value;
    // Then - it names itself
    expect(name).toBe('scenario');
});
