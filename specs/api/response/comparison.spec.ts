import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('comparison', () => {
    test('matches dynamic values through tokens, a ref holding its first value', async () => {
        // Given - an endpoint returning a random uuid twice and a timestamp
        const result = await api.get('/session');

        // Then - {{uuid#session}} captures the id and requires the echo to hold the same one; content-type is asserted as a subset header
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: {{string}}

            {
                "echo": {
                    "sessionId": "{{uuid#session}}"
                },
                "id": "{{uuid#session}}",
                "startedAt": "{{iso8601}}",
                "ttl": 3600
            }
        `);
    });

    test('a journey sends what an earlier response carried, and gets the same session back', async () => {
        // Given - a session, then two calls that send its id
        const session = await api.get('/session');
        const { body } = session.response;
        const id = typeof body === 'object' && body !== null && 'id' in body ? String(body.id) : '';
        const echoed = await api.get(`/echo/${id}`);
        const posted = await api.headers({ 'x-chain': id }).post('/echo', { session: id });

        // Then - the session, then each response carrying the id it was sent
        expect(session.response).toMatch(`
            HTTP/1.1 200 OK

            {"echo": {"sessionId": "${id}"}, "id": "${id}", "startedAt": "{{iso8601}}", "ttl": 3600}
        `);
        expect(echoed.response).toMatch(`
            HTTP/1.1 200 OK

            {"value": "${id}"}
        `);
        expect(posted.response).toMatch(`
            HTTP/1.1 200 OK

            {"body": {"session": "${id}"}, "headers": {"x-chain": "${id}", "x-file": null}}
        `);
    });

    test('fails when a ref captures two different values', async () => {
        // Given - an expectation that reuses one ref for fields with different values
        const result = await api.get('/session');

        // Then - the second occurrence of {{…#val}} must equal the capture, and does not
        expect(() => {
            expect(result.response).toMatch(
                `
                    HTTP/1.1 200 OK

                    {
                        "echo": { "sessionId": "{{uuid#val}}" },
                        "id": "{{uuid#val}}",
                        "startedAt": "{{string#val}}",
                        "ttl": "{{number}}"
                    }
                `,
                { frozen: true },
            );
        }).toThrow(/Response mismatch/u);
    });

    test('reports a status-line mismatch with expected and received codes', async () => {
        // Given - an expectation of 201 for an endpoint that returns 200
        const result = await api.get('/session');

        // Then - the failure names the value in place and both status codes
        expect(() => {
            expect(result.response).toMatch('HTTP/1.1 201 Created', { frozen: true });
        }).toThrow(
            /Response status mismatch \(the value in place\)[\s\S]*expected: 201[\s\S]*received: 200/u,
        );
    });

    test('reports a subset-header mismatch with the wrong value', async () => {
        // Given - an expectation pinning content-type to a value the app never sends
        const result = await api.get('/session');

        // Then - the failure names the header and shows expected vs received
        expect(() => {
            expect(result.response).toMatch(
                `
                    HTTP/1.1 200 OK
                    content-type: text/html
                `,
                { frozen: true },
            );
        }).toThrow(
            /Response header mismatch \(the value in place\)[\s\S]*header: content-type[\s\S]*expected: text\/html[\s\S]*received: application\/json/u,
        );
    });

    // RUNTIME expected-headers-are-a-subset — a response expectation starts with a status line and its headers are matched as a SUBSET: the ones listed must match, the rest are unconstrained.
    test('reports a subset-header mismatch when the header is absent', async () => {
        // Given - an expectation listing a header the response does not carry
        const result = await api.get('/session');

        // Then - the failure shows the header as absent
        expect(() => {
            expect(result.response).toMatch(
                `
                    HTTP/1.1 200 OK
                    x-request-id: {{string}}
                `,
                { frozen: true },
            );
        }).toThrow(
            /Response header mismatch \(the value in place\)[\s\S]*header: x-request-id[\s\S]*received: \(absent\)/u,
        );
    });
});
