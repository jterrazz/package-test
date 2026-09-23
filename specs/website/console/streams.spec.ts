import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

test('keeps a clean page silent on both streams', async () => {
    // Given - the healthy homepage
    const result = await website.visit('/');

    // Then - no console output at all
    expect(result.console.text).toBe('');
    expect(result.errors.text).toBe('');
});

test('separates console errors from the full stream', async () => {
    // Given - a page that logs and errors
    const result = await website.visit('/noisy');

    // Then - the full stream carries both, the error stream only the error
    expect(result.console).toMatch(`
        [log] hello
        [error] boom`);
    expect(result.errors.text).toContain('boom');
});

test('carries an uncaught exception of the page on both streams', async () => {
    // Given - a page whose script throws and logs nothing
    const result = await website.visit('/thrown');

    // Then - the exception is an error, as the component facet reports one
    expect(result.errors.text).toBe('Uncaught Error: the page broke');
    expect(result.console.text).toBe('[error] Uncaught Error: the page broke');
});
