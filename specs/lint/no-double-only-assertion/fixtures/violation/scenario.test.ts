import { describe, expect, test, vi } from 'vitest';

import { scenario } from './scenario.js';

describe('scenario', () => {
test('proves only that it called its own double', () => {
    // Given - a double the test built
    const record = vi.fn();
    record(scenario());
    // Then - the whole proof is the call log
    expect(record).toHaveBeenCalledWith('scenario');
});
});
