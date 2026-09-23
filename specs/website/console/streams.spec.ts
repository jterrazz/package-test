import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('streams', () => {
    test('keeps a clean page silent on both streams', async () => {
        // Given - the healthy homepage
        const result = await website.visit('/');

        // Then - no console output at all
        expect(result.console.text).toBe('');
        expect(result.errors.text).toBe('');
    });
});
