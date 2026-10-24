import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PeerCertificate } from 'node:tls';
import { describe, expect, test } from 'vitest';

import { tlsFacts } from '../tls-facts.js';

function certificateOf(path: string): PeerCertificate {
    const pem = readFileSync(resolve(import.meta.dirname, path), 'utf8');
    return new X509Certificate(pem).toLegacyObject();
}

const ONE_DAY_BEFORE_EXPIRY = Date.parse('2125-12-31T00:00:00.000Z');

describe('tls-facts', () => {
    test('tlsFacts — the certificate an exchange was presented — its names, its issuer, its dates and the margin left at the exchange', () => {
        // Given - a certificate the test authority signed, read a day before it expires, trusted
        const facts = tlsFacts(
            certificateOf('./__fixtures__/site.pem'),
            { authorizationError: undefined, protocol: 'TLSv1.3' },
            ONE_DAY_BEFORE_EXPIRY,
        );

        // Then - every fact as a test reads it
        const { covers, ...read } = facts;
        expect([read, typeof covers]).toStrictEqual([
            {
                altNames: ['site.test', '*.site.test', 'localhost', '127.0.0.1'],
                authorizationError: undefined,
                authorized: true,
                daysRemaining: 1,
                issuer: 'Specimen Test CA',
                protocol: 'TLSv1.3',
                subject: 'site.test',
                validFrom: new Date('2026-01-01T00:00:00.000Z'),
                validTo: new Date('2126-01-01T00:00:00.000Z'),
            },
            'function',
        ]);
    });

    test('tlsFacts — the certificate an exchange was presented — a refused one is not authorized, and its margin goes negative once it expires', () => {
        // Given - a self-signed certificate, refused, read a day and a half after it expired
        const facts = tlsFacts(
            certificateOf('./__fixtures__/self-signed.pem'),
            { authorizationError: 'DEPTH_ZERO_SELF_SIGNED_CERT', protocol: undefined },
            Date.parse('2126-01-02T12:00:00.000Z'),
        );

        // Then - the verdict, the issuer that is its own subject, and the days it is past
        expect([
            facts.authorized,
            facts.authorizationError,
            facts.issuer,
            facts.daysRemaining,
        ]).toStrictEqual([false, 'DEPTH_ZERO_SELF_SIGNED_CERT', 'site.test', -2]);
    });

    test('tlsFacts — the certificate an exchange was presented — one that names no subjectAltName is valid for no name', () => {
        // Given - the test authority's own certificate, which carries no alternative name
        const facts = tlsFacts(
            certificateOf('./__fixtures__/ca.pem'),
            { authorizationError: undefined, protocol: undefined },
            ONE_DAY_BEFORE_EXPIRY,
        );

        // Then - no name, and the subject and issuer it states
        expect([facts.altNames, facts.subject, facts.issuer]).toStrictEqual([
            [],
            'Specimen Test CA',
            'Specimen Test CA',
        ]);
    });

    test('tlsFacts — covers — a host is covered as a client reads the names: exactly, or one label under a wildcard', () => {
        // Given - the certificate naming site.test, *.site.test, localhost and 127.0.0.1
        const facts = tlsFacts(
            certificateOf('./__fixtures__/site.pem'),
            { authorizationError: undefined, protocol: undefined },
            ONE_DAY_BEFORE_EXPIRY,
        );

        // Then - each host judged
        expect(
            [
                'site.test',
                'api.site.test',
                'deep.api.site.test',
                'localhost',
                '127.0.0.1',
                'other.test',
            ].map((host) => facts.covers(host)),
        ).toStrictEqual([true, true, false, true, true, false]);
    });
});
