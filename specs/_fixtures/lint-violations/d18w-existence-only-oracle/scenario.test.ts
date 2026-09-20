import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('records only that something came back', () => {
    // Given - a scenario
    const value = scenario();
    // Then - the whole proof is an existence check
    expect(value).toBeDefined();
});
