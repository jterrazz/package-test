import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../../api.specification.js';

describe('listing', () => {
    test('a point is detailed over the same base', async () => {
        // Given - the same base
        const result = await api.seed(file('../../../../shared/seeds/single-base.sql')).get('/map/pois/detail');

        // Then - the app answered
        expect(result.status).toBe(200);
    });
});
