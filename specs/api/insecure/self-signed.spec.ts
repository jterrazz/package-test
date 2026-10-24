import { describe, expect, test } from 'vitest';

import { api } from '../insecure.specification.js';

describe('self-signed', () => {
    test('an insecure specification accepts a certificate the trust check refuses, and says why it would have', async () => {
        // Given - the self-signed deployed api, accepted on purpose
        const result = await api.get('/health');

        // Then - the answer, and the verdict it was accepted over
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK

            {"status": "ok"}
        `);
        expect(result.tls).toMatchObject({
            authorizationError: 'DEPTH_ZERO_SELF_SIGNED_CERT',
            authorized: false,
            issuer: 'site.test',
        });
    });
});
