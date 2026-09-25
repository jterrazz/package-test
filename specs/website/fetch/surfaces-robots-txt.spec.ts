import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('surfaces-robots-txt', () => {
    test('serves robots.txt as plain text', async () => {
        // Given - the robots surface
        const result = await website.fetch('/robots.txt');

        // Then - the whole file matches one golden
        expect(result.status).toBe(200);
        expect(result.headers['content-type']).toBe('text/plain');
        expect(result.body).toMatch(`
        User-Agent: *
        Allow: /

        Sitemap: https://site.test/sitemap.xml
    `);
    });

    test('refuses to read a plain-text body as JSON, naming the body', async () => {
        // Given - the robots surface, which is no JSON
        const result = await website.fetch('/robots.txt');

        // Then - reading it as JSON names the stream it parsed and shows its start
        expect(() => result.json.value).toThrow(/^body is not valid JSON: User-Agent: \*/u);
    });

    test('sends chain headers on the raw exchange', async () => {
        // Given - an AI crawler user agent
        const result = await website.headers({ 'User-Agent': 'GPTBot/1.0' }).fetch('/robots.txt');

        // Then - the exchange succeeds like any other client
        expect(result.status).toBe(200);
        expect(result.body.text).toContain('Allow: /');
    });
});
