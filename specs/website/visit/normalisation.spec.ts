import { expect, test } from 'vitest';

import { website } from '../normalisation.specification.js';

test('drops what the framework wrote into the head before the comparison', async () => {
    // Given - a page whose head carries two metas the framework owns and the spec never asked for
    const result = await website.visit('/framework');

    // Then - the golden is the head the SITE declares: the runner's transform ran before the comparison
    expect(result.head).toMatch({
        alternates: {
            en: 'https://site.test/framework',
            fr: 'https://site.test/fr/framework',
            'x-default': 'https://site.test/framework',
        },
        canonical: 'https://site.test/framework',
        metas: {
            description: 'A tiny site the specs can trust.',
            'og:title': 'Fixture — Framework',
            'og:image': 'https://site.test/assets/card.png',
        },
        title: 'Fixture — Framework',
    });
});

test('leaves the raw reading alone', async () => {
    // Given - the same page
    const result = await website.visit('/framework');

    // Then - the meta is still there to be read: a transform normalises what is COMPARED, never what the page said
    expect(result.meta('framework-transitions-fallback')).toBe('animate');
});
