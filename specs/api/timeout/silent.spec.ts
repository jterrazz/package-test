import { describe, expect, test } from 'vitest';

import { api, specimen } from '../deployed.specification.js';

describe('silent', () => {
    test('a socket that accepts and never answers reads as a timeout once the deadline passes', async () => {
        // Given - a server holding the connection open, and the specification's one-second deadline
        const result = await api.get(`${specimen.silent}/health`);

        // Then - the deadline is why
        expect(result.response).toMatch('unreachable: timeout');
    });

    test('a deadline passed after the handshake still says which certificate was presented', async () => {
        // Given - a server that completes TLS, then never answers the request
        const result = await api.get(`${specimen.secureSilent}/health`);

        // Then - the deadline is why, and the certificate is read all the same
        expect(result.response).toMatch('unreachable: timeout');
        expect(result.tls).toMatchObject({ authorized: true, subject: 'site.test' });
    });
});
