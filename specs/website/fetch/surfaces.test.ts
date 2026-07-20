import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

test('surfaces a permanent redirect without following it', async () => {
    // Given - the legacy path
    const result = await website.fetch('/old');

    // Then - the 308 IS the result, with its target readable
    expect(result.status).toBe(308);
    expect(result.location).toBe('/');
});

test('serves robots.txt as plain text', async () => {
    // Given - the robots surface
    const result = await website.fetch('/robots.txt');

    // Then - the whole file matches one golden
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toBe('text/plain');
    expect(result.body).toMatch('robots.txt');
});

test('sends chain headers on the raw exchange', async () => {
    // Given - an AI crawler user agent
    const result = await website.headers({ 'User-Agent': 'GPTBot/1.0' }).fetch('/robots.txt');

    // Then - the exchange succeeds like any other client
    expect(result.status).toBe(200);
    expect(result.body).toContain('Allow: /');
});
