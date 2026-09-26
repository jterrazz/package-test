import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('listing', () => {
    test('the areas are listed over the two points', async () => {
        // Given - the two points the map routes share
        const result = await api.seed(file('../../../_shared/_seeds/two-pois.sql')).get('/map/areas');

        // Then - the app answered
        expect(result.status).toBe(200);
    });
});
