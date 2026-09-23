import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

test('reads the title, the rendered markup and the head links of the page it visited', async () => {
    // Given - a visit to the landmarks page, scripts run
    const result = await website.visit('/landmarks');

    // Then - the title as text, the DOM as the browser serialised it, and every <link> of the head in order
    expect(result.title.text).toBe('Fixture — Landmarks');
    expect(result.html).toMatch(file('./expected/landmarks.html'));
    expect(result.links).toMatchObject([
        { href: 'https://site.test/landmarks', rel: 'canonical' },
        { href: 'https://site.test/landmarks', hreflang: 'en', rel: 'alternate' },
        { href: 'https://site.test/fr/landmarks', hreflang: 'fr', rel: 'alternate' },
        { href: 'https://site.test/landmarks', hreflang: 'x-default', rel: 'alternate' },
    ]);
});
