import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('streams-noisy', () => {
    test('separates console errors from the full stream', async () => {
        // Given - a page that logs and errors
        const result = await website.visit('/noisy');

        // Then - the full stream carries both, the error stream only the error
        expect(result.console).toMatch(`
        [log] hello
        [error] boom`);
        expect(result.errors.text).toContain('boom');
    });
});
