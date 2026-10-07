import { describe, expect, test, vi } from 'vitest';

import { remember } from '../storage.js';

vi.mock('@react-native-async-storage/async-storage');

describe('remember', () => {
    test('keeps the value it is handed', async () => {
        // Given - the native store doubled
        const kept = await remember('token');

        // Then - the value comes back
        expect(kept).toBe('token');
    });
});
