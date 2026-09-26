import { describe, expect, test } from 'vitest';

import { request } from './request.action.js';

describe('request.action', () => {
    test('answers the method it was handed', () => {
        // Given - a method
        const method = 'GET';

        // Then - the same method
        expect(request(method)).toBe('GET');
    });
});
