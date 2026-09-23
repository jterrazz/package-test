import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('surfaces', () => {
    test('surfaces a permanent redirect without following it', async () => {
        // Given - the legacy path
        const result = await website.fetch('/old');

        // Then - the 308 IS the result, with its target readable
        expect(result.status).toBe(308);
        expect(result.location).toBe('/');
    });
});
