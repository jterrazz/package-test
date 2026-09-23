import { content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website as opened } from '../backend.specification.js';
import { website } from '../website.specification.js';

describe('external', () => {
    test('a local server keeps every request on the site', async () => {
        // Given - a page asking another origin for a resource, under the default policy
        const result = await website.visit('/external', async (visitor) => {
            await visitor.see(content('Cross-origin blocked'));
        });

        // Then - the request never left
        expect(result.content.text).toContain('Cross-origin blocked');
    });

    test('external: allow lets a request leave the site', async () => {
        // Given - the same page, under a runner that opened the policy
        const result = await opened.visit('/external', async (visitor) => {
            await visitor.see(content('Cross-origin reached'));
        });

        // Then - the request reached the other origin
        expect(result.content.text).toContain('Cross-origin reached');
    });
});
