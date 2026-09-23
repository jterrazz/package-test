import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';
import { FIRST_PAGE } from '../pages.js';

describe('pagination', () => {
    test('lists the first page', async () => {
        // Given - the events the app holds
        const result = await api.get('/events');

        // Then - the whole page
        expect(result.response).toMatch(FIRST_PAGE);
    });
});
