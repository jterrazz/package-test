import { expect, test, vi } from 'vitest';

import payload from './payload.json';

vi.mock('./util.js');

test('doubles', () => {
    // Given - a raw data asset and a module mock
    // Then - both are flagged by I4
    expect(payload).toBeDefined();
});
