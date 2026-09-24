import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('listing', () => {
    test('the points are listed over the base', async () => {
        // Given - the one base the route and its detail share
        const result = await api.seed(file('../../../seeds/single-base.sql')).get('/map/pois');

        // Then - the app answered
        expect(result.status).toBe(200);
    });
});
