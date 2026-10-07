import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

const LEGACY_ARTICLE_SLUGS = ['the-old-notes', 'a-moved-essay'];

describe('registry', () => {
    test('lists every rule', async () => {
        // Given - the registry
        const result = await api.get('/redirects');

        // Then - the rules
        expect(result.status).toBe(200);
    });

    for (const slug of LEGACY_ARTICLE_SLUGS) {
        test(`moves ${slug} for good`, async () => {
            // Given - a legacy slug
            const result = await api.get('/articles/:slug', { params: { slug } });

            // Then - a permanent redirect
            expect(result.status).toBe(301);
        });
    }
});
