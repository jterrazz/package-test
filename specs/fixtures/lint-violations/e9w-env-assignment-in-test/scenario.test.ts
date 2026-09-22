import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('writes the environment it reads', () => {
    // Given - a variable assigned straight onto the process
    process.env.SCENARIO = 'written';
    // Then - the module reads it back
    expect(scenario()).toBe('written');
});
