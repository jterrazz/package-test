import { expect, test, vi } from 'vitest';

import { scenario } from './scenario.js';

test('states the environment through the stub that restores itself', () => {
    // Given - a variable stubbed for the length of the test
    vi.stubEnv('SCENARIO', 'written');
    // Then - the module reads it back
    expect(scenario()).toBe('written');
});
