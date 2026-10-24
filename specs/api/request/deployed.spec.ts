import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api, specimen } from '../deployed.specification.js';

describe('deployed', () => {
    test('a complete request written in place is sent whole: its method, headers and body', async () => {
        // Given - a request naming the URL whole, with a header and a body
        const result = await api.request(`
            POST ${specimen.plain}/echo
            x-probe: in-place

            hello
        `);

        // Then - the deployed api saw each part of it
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"body": "hello", "host": "127.0.0.1:{{port}}", "method": "POST", "probe": "in-place", "servername": null}
        `);
    });

    test('a request file several tests send is named by its path', async () => {
        // Given - the shared request, its path read from the base url
        const result = await api.request(file('./__requests__/deployed-echo.http'));

        // Then - the file's header and body arrived
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK

            {"body": "ping", "host": "127.0.0.1:{{port}}", "method": "POST", "probe": "from-the-file", "servername": null}
        `);
    });

    test("a chain's headers are sent over the file's, a name read case-blind", async () => {
        // Given - the shared request, its probe header replaced by the chain
        const result = await api
            .headers({ 'X-Probe': 'from-the-chain' })
            .request(file('./__requests__/deployed-echo.http'));

        // Then - the chain's value won
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK

            {"body": "ping", "host": "127.0.0.1:{{port}}", "method": "POST", "probe": "from-the-chain", "servername": null}
        `);
    });
});
