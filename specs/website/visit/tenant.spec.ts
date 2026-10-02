import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('tenant', () => {
    test('the headers the chain carries reach the page the visit requests', async () => {
        // Given - a visit carrying the tenant header the page renders
        const result = await website.headers({ 'x-tenant': 'acme' }).visit('/tenant');

        // Then - the server rendered the tenant it was sent
        expect(result.html.text).toBe(
            '<html lang="en"><head><title>Fixture — Tenant</title></head><body><h1>Tenant</h1><p>acme</p></body></html>',
        );
    });
});
