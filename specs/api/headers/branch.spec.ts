import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('branch', () => {
    test('a header set on a branch never reaches the chain it forked from', async () => {
        // Given - a chain with a header, and a branch of it replacing that header, sent first
        const tagged = api.headers({ 'x-chain': 'trunk' });
        await tagged.headers({ 'x-chain': 'branch' }).post('/echo', { greeting: 'branch' });

        // When - the chain it forked from is sent
        const result = await tagged.post('/echo', { greeting: 'trunk' });

        // Then - the request carried the chain's own header, never the branch's
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"body": {"greeting": "trunk"}, "headers": {"x-chain": "trunk", "x-file": null}}
        `);
    });
});
