import { describe, expect, test } from 'vitest';

import { defineContract, http } from '../../../src/index.js';
import { api, QUOTES_URL } from '../intercepts.specification.js';

describe('filters', () => {
    test('a body/header/query-filtered request matches the outgoing POST', async () => {
        // Given - a filtered request half narrowing on a body subset, a header, and a query param — all of which the /submit route satisfies
        const result = await api
            .intercept(
                http.post(QUOTES_URL, {
                    body: { user: { role: 'admin' } },
                    headers: { 'x-tenant': 'acme' },
                    query: { lang: 'en' },
                }),
                http.json({ quote: 'filtered' }),
            )
            .get('/submit');

        // Then - the filter accepted the request and returned its response
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "quote": "filtered"
            }
        `);
    });

    test('a request that fails the body filter counts as unmatched (D7)', async () => {
        // Given - a filter demanding a role the outgoing body does not carry
        const chain = api
            .intercept(
                http.post(QUOTES_URL, { body: { user: { role: 'guest' } } }),
                http.json({ quote: 'never' }),
            )
            .get('/submit');

        // Then - the URL/method matched but the filter did not: strict failure
        await expect(chain).rejects.toThrow(
            `found: an unmatched outgoing request, POST ${QUOTES_URL}`,
        );
    });

    test('a contract computes its response body from the request body', async () => {
        // Given - a contract whose response derives from the observed request: the /submit route POSTs { action, user: { role: 'admin' } }
        const result = await api
            .intercept(
                defineContract({
                    request: http.post(QUOTES_URL),
                    response: (request) => {
                        const body = request.body as { action: string; user: { role: string } };
                        return http.json({ echoedAction: body.action, forRole: body.user.role });
                    },
                }),
            )
            .get('/submit');

        // Then - the reply was derived from the outgoing request body
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "echoedAction": "quote",
                "forRole": "admin"
            }
        `);
    });

    test('an inline .intercept(request, fn) responder derives status and body per request', async () => {
        // Given - an inline responder reading a header off the observed request
        const result = await api
            .intercept(http.post(QUOTES_URL), (request) => {
                const tenant = request.headers['x-tenant'];
                return http.json({ quote: `hello ${tenant}` }, { status: 201 });
            })
            .get('/submit');

        // Then - the function ran at serve time, shaping status and body
        expect(result.response).toMatch(`
            HTTP/1.1 201 Created
            content-type: application/json

            {
                "quote": "hello acme"
            }
        `);
    });
});
