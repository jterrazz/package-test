import { defineStub, http } from '@jterrazz/test/stubs';
import { describe, expect, test } from 'vitest';

import { api, QUOTES_URL } from '../intercepts.specification.js';

describe('filters', () => {
    test('a body/header/query-filtered request matches the outgoing POST', async () => {
        // Given - a filtered request half narrowing on a body subset, a header, and a query param, all of which the /submit route satisfies
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

    test('a request that fails the body filter counts as unmatched (`network-strict-after-first-stub`)', async () => {
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

    test('a request without the headers a stub states absent matches it', async () => {
        // Given - a stub forbidding a cookie the /submit request never carries
        const result = await api
            .intercept(
                http.post(QUOTES_URL, { without: { headers: ['Cookie'] } }),
                http.json({ quote: 'anonymous' }),
            )
            .get('/submit');

        // Then - the absent header let the stub fire
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "quote": "anonymous"
            }
        `);
    });

    test('a request carrying a header the stub states absent is unmatched, and the refusal names it', async () => {
        // Given - a stub forbidding the x-tenant header the /submit request carries
        const chain = api
            .intercept(
                http.post(QUOTES_URL, { without: { headers: ['x-tenant'] } }),
                http.json({ quote: 'never' }),
            )
            .get('/submit');

        // Then - strict failure, the declared stub listed with the header it forbids
        await expect(chain).rejects.toThrow(
            `found: an unmatched outgoing request, POST ${QUOTES_URL}?lang=en`,
        );
        await expect(chain).rejects.toThrow(`- POST ${QUOTES_URL} (without header x-tenant)`);
    });

    test('a stub computes its response body from the request body', async () => {
        // Given - a stub whose response derives from the observed request: the /submit route POSTs { action, user: { role: 'admin' } }
        const result = await api
            .intercept(
                defineStub({
                    request: http.post(QUOTES_URL),
                    response: (request) => {
                        const { body } = request;
                        const action =
                            typeof body === 'object' && body !== null && 'action' in body
                                ? body.action
                                : null;
                        const user =
                            typeof body === 'object' && body !== null && 'user' in body
                                ? body.user
                                : null;
                        const role =
                            typeof user === 'object' && user !== null && 'role' in user
                                ? user.role
                                : null;
                        return http.json({ echoedAction: action, forRole: role });
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
