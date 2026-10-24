import { describe, expect, test } from 'vitest';

import { deployment, specimen } from '../deployment.specification.js';

describe('certificate', () => {
    test('the certificate presented is read off the result: who it names, who signed it, and its margin', async () => {
        // Given - the https deployment, its certificate signed by the authority the specification trusts
        const result = await deployment.get(`${specimen.secure}/health`);

        // Then - the answer, and the facts of the certificate it came over
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK

            {"status": "ok"}
        `);
        expect(result.tls).toMatchObject({
            altNames: ['site.test', '*.site.test', 'localhost', '127.0.0.1'],
            authorizationError: undefined,
            authorized: true,
            issuer: 'Specimen Test CA',
            subject: 'site.test',
            validTo: new Date('2126-01-01T00:00:00.000Z'),
        });
        expect(result.tls?.daysRemaining).toBeGreaterThanOrEqual(30);
    });

    test('whether the certificate covers a host is read as a client reads it, wildcards included', async () => {
        // Given - the https deployment
        const result = await deployment.get(`${specimen.secure}/health`);

        // Then - each host judged against the names it carries
        expect(result.response).toMatch('HTTP/1.1 200 OK');
        expect(
            ['site.test', 'grafana.site.test', 'deep.grafana.site.test', 'other.test'].map((host) =>
                result.tls?.covers(host),
            ),
        ).toStrictEqual([true, true, false, false]);
    });
});
