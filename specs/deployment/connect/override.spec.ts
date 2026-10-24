import { describe, expect, test } from 'vitest';

import { deployment, specimen } from '../deployment.specification.js';

describe('override', () => {
    test("the socket opens on the address given, the host header and the server name staying the url's", async () => {
        // Given - a name no resolver knows, sent to the address that serves it
        const result = await deployment
            .connect(`127.0.0.1:${String(specimen.securePort)}`)
            .get('https://site.test/echo');

        // Then - the deployment saw the url's host, over TLS named for it, and the certificate was trusted
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK

            {"body": "", "host": "site.test", "method": "GET", "probe": null, "servername": "site.test"}
        `);
        expect(result.tls?.authorized).toBe(true);
    });

    test('a host the address does not serve is refused at the edge, as a request smuggling an internal host is', async () => {
        // Given - an internal host, sent to the public address over plain http
        const result = await deployment
            .connect(`127.0.0.1:${String(specimen.plainPort)}`)
            .get('http://grafana.site.test/');

        // Then - the edge refuses the host
        expect(result.response).toMatch(`
            HTTP/1.1 403 Forbidden

            forbidden host
        `);
    });

    test("a certificate that does not cover the url's host is a tls failure, whatever the address", async () => {
        // Given - another host, sent to the address whose certificate names site.test
        const result = await deployment
            .connect(`127.0.0.1:${String(specimen.securePort)}`)
            .get('https://other.test/health');

        // Then - the name check is why
        expect(result.response).toMatch('unreachable: tls ERR_TLS_CERT_ALTNAME_INVALID');
    });
});
