import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

test('keeps a clean page silent on both streams', async () => {
    // Given - the healthy homepage
    const result = await website.visit('/');

    // Then - no console output at all
    await expect(result.console).toBeEmpty();
    await expect(result.errors).toBeEmpty();
});

test('separates console errors from the full stream', async () => {
    // Given - a page that logs and errors
    const result = await website.visit('/noisy');

    // Then - the full stream carries both, the error stream only the error
    expect(result.console).toMatch('noisy.console.txt');
    expect(result.errors).toContain('boom');
});
