import { describe, expect, test } from 'vitest';

import { defineContract, defineContracts, http } from '../../../src/index.js';
import { api, QUOTES_URL } from '../intercepts.specification.js';
import latestNews from './contracts/latest-news.contracts.js';

describe('contracts — selection', () => {
    test('a finite contract plays before the unlimited tail (retry path)', async () => {
        // Given - a rate-limit allowed exactly once, then a success with no
        // Times (unlimited), passed as one list, and an app that retries on 429
        const result = await api
            .intercept([
                { request: http.get(QUOTES_URL), response: http.error(429), times: 1 },
                { request: http.get(QUOTES_URL), response: http.json({ quote: 'after retry' }) },
            ])
            .get('/quote');

        // Then - the retry was served by the tail contract
        expect(result.status).toBe(200);
        expect(result.response.body).toEqual({ quote: 'after retry' });
    });

    test('a contract with no times keeps serving every call', async () => {
        // Given - ONE contract for a route the app calls twice
        const result = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'sticky' }))
            .get('/quote-twice');

        // Then - both calls were served (no times = unlimited, no exhaustion)
        expect(result.status).toBe(200);
        expect(result.response.body).toEqual({ first: 200, second: 200 });
    });

    test('a contract and an inline pair mix in one chain', async () => {
        // Given - a declared contract plus a one-off inline pair
        const result = await api
            .intercept(latestNews)
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'inline' }))
            .get('/combo');

        // Then - each outgoing call got its declared response
        expect(result.status).toBe(200);
        expect(result.response.body).toEqual({
            news: { headline: 'Contract headline' },
            quote: { quote: 'inline' },
        });
    });

    test('a composite scenario overrides one route of the declared world', async () => {
        // Given - a two-route composite, with the quotes route overridden
        const world = defineContracts(latestNews, {
            request: http.get(QUOTES_URL),
            response: http.json({ quote: 'nominal' }),
        });
        const result = await api
            .intercept(
                world.with({ request: http.get(QUOTES_URL), response: http.json({ quote: 'x' }) }),
            )
            .get('/combo');

        // Then - the override answered, the untouched route still did
        expect(result.response.body).toEqual({
            news: { headline: 'Contract headline' },
            quote: { quote: 'x' },
        });
    });

    test('a path-form url matches the call whatever its origin', async () => {
        // Given - the route declared as a path, not an absolute URL
        const result = await api
            .intercept(http.get('/api/quote'), http.json({ quote: 'by path' }))
            .get('/quote');

        // Then - the origin was ignored and the contract served the call
        expect(result.response.body).toEqual({ quote: 'by path' });
    });
});

describe('contracts — strict failures (CONVENTIONS D7)', () => {
    test('an exhausted contract rejects the action with method, URL, and the declared list', async () => {
        // Given - a contract allowed exactly once while the app calls twice
        const chain = api
            .intercept([
                {
                    request: http.get(QUOTES_URL),
                    response: http.json({ quote: 'only one' }),
                    times: 1,
                },
            ])
            .get('/quote-twice');

        // Then - the spec fails with the offending request and the queue state
        await expect(chain).rejects.toThrow(
            `Unmatched outgoing HTTP request during spec: GET ${QUOTES_URL}`,
        );
        await expect(chain).rejects.toThrow(`- GET ${QUOTES_URL} (exhausted after 1)`);
    });

    test('a request no contract was declared for rejects the action', async () => {
        // Given - a contract for the quotes provider only, while the app
        // Calls an entirely different host
        const chain = api.intercept(http.get(QUOTES_URL), http.json({})).get('/other');

        // Then - the error names the offending request and the declared routes
        await expect(chain).rejects.toThrow(
            'Unmatched outgoing HTTP request during spec: GET https://unregistered.spec.test/thing',
        );
        await expect(chain).rejects.toThrow(`- GET ${QUOTES_URL}`);
    });

    test('a required contract the app never calls rejects the action', async () => {
        // Given - a contract the spec claims the route MUST call, on an
        // Action that never reaches the network
        const chain = api
            .intercept({
                request: http.get(QUOTES_URL),
                response: http.json({ quote: 'never' }),
                required: true,
            })
            .get('/health');

        // Then - the silent omission is the failure, naming the route
        await expect(chain).rejects.toThrow(
            `- GET ${QUOTES_URL} — declared and required but never requested`,
        );
    });
});

describe('contracts — http request filters', () => {
    test('a body/header/query-filtered request matches the outgoing POST', async () => {
        // Given - a filtered request half narrowing on a body subset, a header,
        // And a query param — all of which the /submit route satisfies
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
        expect(result.status).toBe(200);
        expect(result.response.body).toEqual({ quote: 'filtered' });
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
            `Unmatched outgoing HTTP request during spec: POST ${QUOTES_URL}`,
        );
    });
});

describe('contracts — dynamic responses', () => {
    test('a contract computes its response body from the request body', async () => {
        // Given - a contract whose response derives from the observed request:
        // The /submit route POSTs { action, user: { role: 'admin' } }
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
        expect(result.status).toBe(200);
        expect(result.response.body).toEqual({ echoedAction: 'quote', forRole: 'admin' });
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
        expect(result.status).toBe(201);
        expect(result.response.body).toEqual({ quote: 'hello acme' });
    });
});

describe('contracts — chain isolation', () => {
    test('an unused contract from one chain does not leak into the next', async () => {
        // Given - a first chain declaring a contract its action never uses
        const first = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'FIRST' }))
            .get('/health');
        expect(first.status).toBe(200);

        // When - a second chain declares its own contract for the same route
        const second = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'SECOND' }))
            .get('/quote');

        // Then - the second chain served ITS contract, not the leftover
        expect(second.status).toBe(200);
        expect(second.response.body).toEqual({ quote: 'SECOND' });
    });
});
