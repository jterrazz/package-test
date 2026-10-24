import { describe, expect, test } from 'vitest';

import { api, specimen } from '../deployed.specification.js';

describe('refused', () => {
    test('an expired certificate is a tls failure, and its facts still say by how much', async () => {
        // Given - a certificate the trusted authority signed, expired in 2021
        const result = await api.get(`${specimen.expired}/health`);

        // Then - refused, with the margin it no longer has
        expect(result.response).toMatch('unreachable: tls CERT_HAS_EXPIRED');
        expect(result.tls?.authorizationError).toBe('CERT_HAS_EXPIRED');
        expect(result.tls?.daysRemaining).toBeLessThan(0);
    });

    test('a certificate no authority signed is a tls failure', async () => {
        // Given - a self-signed certificate
        const result = await api.get(`${specimen.selfSigned}/health`);

        // Then - refused
        expect(result.response).toMatch('unreachable: tls DEPTH_ZERO_SELF_SIGNED_CERT');
    });

    test('tls spoken to a plain http port fails the handshake', async () => {
        // Given - https, on the port that answers plain http
        const result = await api.get(`https://127.0.0.1:${String(specimen.plainPort)}/health`);

        // Then - the handshake is why, in the words of the platform's TLS library
        expect(result.response).toMatch('unreachable: tls {{string}}');
    });
});
