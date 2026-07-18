import { describe, expect, test } from 'vitest';

import { defineContract, http } from '../../../src/index.js';
import { api, QUOTES_URL } from '../intercepts.specification.js';
import latestNews from './contracts/latest-news.http.js';

describe('intercepts — FIFO queue', () => {
    test('same trigger declared twice fires in order: 429 then 200 (retry path)', async () => {
        // Given - a rate-limit first, a success second, passed as a single
        // Array of contracts (array order === consecutive-call FIFO), and an
        // App that retries once on 429
        const result = await api
            .intercept([
                { response: http.error(429), trigger: http.get(QUOTES_URL) },
                { response: http.json({ quote: 'after retry' }), trigger: http.get(QUOTES_URL) },
            ])
            .get('/quote');

        // Then - the retry consumed the second entry
        expect(result.status).toBe(200);
        expect(result.response.body).toEqual({ quote: 'after retry' });
    });

    test('a contract and an inline intercept mix in one chain', async () => {
        // Given - a declared contract plus a one-off inline intercept
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
});

describe('intercepts — strict failures (CONVENTIONS D7)', () => {
    test('an exhausted queue rejects the action with method, URL, and trigger list', async () => {
        // Given - ONE intercept while the app calls the provider twice
        const chain = api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'only one' }))
            .get('/quote-twice');

        // Then - the spec fails with the offending request and the queue state
        await expect(chain).rejects.toThrow(
            `Unmatched outgoing HTTP request during spec: GET ${QUOTES_URL}`,
        );
        await expect(chain).rejects.toThrow(`- GET ${QUOTES_URL} (already consumed)`);
    });

    test('a request no intercept was declared for rejects the action', async () => {
        // Given - an intercept for the quotes provider only, while the app
        // Calls an entirely different host
        const chain = api.intercept(http.get(QUOTES_URL), http.json({})).get('/other');

        // Then - the error names the offending request and the registered triggers
        await expect(chain).rejects.toThrow(
            'Unmatched outgoing HTTP request during spec: GET https://unregistered.spec.test/thing',
        );
        await expect(chain).rejects.toThrow(`- GET ${QUOTES_URL}`);
    });
});

describe('intercepts — http trigger filters', () => {
    test('a body/header/query-filtered http trigger matches the outgoing POST', async () => {
        // Given - a filtered trigger narrowing on a body subset, a header, and
        // A query param — all of which the /submit route satisfies
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

describe('intercepts — dynamic responses', () => {
    test('a contract computes its response body from the request body', async () => {
        // Given - a contract whose response is a function of the observed request:
        // The /submit route POSTs { action, user: { role: 'admin' } }
        const result = await api
            .intercept(
                defineContract({
                    response: (request) => {
                        const body = request.body as { action: string; user: { role: string } };
                        return http.json({ echoedAction: body.action, forRole: body.user.role });
                    },
                    trigger: http.post(QUOTES_URL),
                }),
            )
            .get('/submit');

        // Then - the reply was derived from the outgoing request body
        expect(result.status).toBe(200);
        expect(result.response.body).toEqual({ echoedAction: 'quote', forRole: 'admin' });
    });

    test('an inline .intercept(trigger, fn) responder derives status and body per request', async () => {
        // Given - an inline responder reading a header off the observed request
        const result = await api
            .intercept(http.post(QUOTES_URL), (request) => {
                const tenant = request.headers['x-tenant'];
                return http.json({ quote: `hello ${tenant}` }, 201);
            })
            .get('/submit');

        // Then - the function ran at consumption time, shaping status and body
        expect(result.status).toBe(201);
        expect(result.response.body).toEqual({ quote: 'hello acme' });
    });
});

describe('intercepts — chain isolation', () => {
    test('an unconsumed intercept from one chain does not leak into the next', async () => {
        // Given - a first chain declaring an intercept its action never consumes
        const first = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'FIRST' }))
            .get('/health');
        expect(first.status).toBe(200);

        // When - a second chain declares its own intercept for the same trigger
        const second = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'SECOND' }))
            .get('/quote');

        // Then - the second chain consumed ITS intercept, not the leftover
        expect(second.status).toBe(200);
        expect(second.response.body).toEqual({ quote: 'SECOND' });
    });
});
