import { describe, expect, test } from 'vitest';

import { website } from '../services.specification.js';

describe('website — a process declared beside the site', () => {
    test('the site is handed the URL the framework chose for it', async () => {
        // Given - the page that renders what the server was started with
        const result = await website.visit('/services');

        // Then - it names the loopback URL of the process declared beside it
        expect(result.content).toContain('http://127.0.0.1:');
    });

    test('every process of the run carries the id the facet minted', async () => {
        // Given - the same page, which also renders the run id
        const result = await website.visit('/services');

        // Then - the id is there, and it is not something the spec sampled
        expect(result.content).not.toContain('unset');
    });
});
