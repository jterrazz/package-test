import { describe, expect, test, vi } from 'vitest';

import payload from './payload.json';

vi.mock('./util.js');

describe('double', () => {
test('doubles', () => {
    // Given - a raw data asset and a module mock
    // Then - both are flagged by `no-module-mock`
    expect(payload).toBeDefined();
});
});
