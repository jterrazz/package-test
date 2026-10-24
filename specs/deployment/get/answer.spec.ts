import { describe, expect, test } from 'vitest';

import { deployment, specimen } from '../deployment.specification.js';

describe('answer', () => {
    test('a path is read from the base url, and the whole response is compared in place', async () => {
        // Given - the health route of the deployment the specification names
        const result = await deployment.get('/health');

        // Then - the status, the headers the test names, and the body
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json
            x-frame-options: DENY

            {"status": "ok"}
        `);
    });

    test('a url written whole reaches the host it names, whatever the base', async () => {
        // Given - the same route, its URL written whole
        const result = await deployment.get(`${specimen.plain}/health`);

        // Then - the same answer
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"status": "ok"}
        `);
    });

    test('a redirect is the answer, its location readable, never followed', async () => {
        // Given - a route that moved
        const result = await deployment.get('/old');

        // Then - the 301 itself, and where it points
        expect(result.response).toMatch(`
            HTTP/1.1 301 Moved Permanently
            location: /health
        `);
    });

    test('a binary body is not read: the golden states its status and headers', async () => {
        // Given - an image
        const result = await deployment.get('/logo.png');

        // Then - no body to compare
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: image/png
        `);
        expect(result.response.body).toBeNull();
    });
});
