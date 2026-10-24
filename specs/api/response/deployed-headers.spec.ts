import { describe, expect, test } from 'vitest';

import { api } from '../deployed.specification.js';

describe('deployed-headers', () => {
    test('a header the golden leaves out is unconstrained, and one it names is judged', async () => {
        // Given - a route answering cache-control, x-frame-options, a date and a length
        const result = await api.get('/health');

        // Then - the golden names the security header alone
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            x-frame-options: DENY
        `);
    });

    test('a named header the response answers differently fails, saying which', async () => {
        // Given - a golden expecting a frame policy the deployed api does not send
        const result = await api.get('/health');

        // Then - the mismatch names the header and both values
        expect(() => {
            expect(result.response).toMatch(
                `
                    HTTP/1.1 200 OK
                    x-frame-options: SAMEORIGIN
                `,
                { frozen: true },
            );
        }).toThrow(
            'Response header mismatch (the value in place)\n  header: x-frame-options\n  expected: SAMEORIGIN\n  received: DENY',
        );
    });
});
