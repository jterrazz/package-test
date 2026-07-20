import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

test('captures the full head surface of a rendered page', async () => {
    // Given - the fixture homepage
    const result = await website.visit('/');

    // Then - one golden covers title, canonical, alternates, and metas
    expect(result.status).toBe(200);
    expect(result.head).toMatch('home.head.json');
});

test('exposes canonical, alternates, and named metas directly', async () => {
    // Given - the fixture homepage
    const result = await website.visit('/');

    // Then - the accessors read the head without a golden
    expect(result.canonical).toBe('https://site.test/');
    expect(result.alternates['x-default']).toBe('https://site.test/');
    expect(result.meta('og:title')).toBe('Fixture — Home');
    expect(result.meta('description')).toBe('A tiny site the specs can trust.');
});

test('parses every json-ld block into one array', async () => {
    // Given - the fixture homepage
    const result = await website.visit('/');

    // Then - the whole structured-data surface matches one golden
    expect(result.jsonLd).toMatch('home.jsonld.json');
});
