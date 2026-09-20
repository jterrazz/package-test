import { expect, test, vi } from 'vitest';

import { scenario } from './scenario.js';

test('asserts what the subject produced, and what it asked of its port', () => {
    // Given - a double the test built
    const record = vi.fn();
    const value = scenario();
    record(value);
    // Then - the value comes first, the call log second
    expect(value).toBe('scenario');
    expect(record).toHaveBeenCalledWith('scenario');
});
