import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('listing', () => {
    test('the pois are listed over the two points', async () => {
        // Given - the two points the map routes share
        const result = await api.seed(file('../../../__seeds__/two-pois.sql')).get('/map/pois');

        // Then - the app answered
        expect(result.status).toBe(200);
    });
});
