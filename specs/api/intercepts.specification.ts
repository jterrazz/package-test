/**
 * Runner for the strict-intercept specs (CONVENTIONS D7). Intercepts are
 * in-process (MSW), so this specification is node-only: the vitest config
 * excludes this folder from the compose (`api-stack`) project (I3).
 *
 * The app under test is a tiny in-file Hono-compatible app whose only job
 * is to make outgoing HTTP calls — the surface the intercepts guard.
 */
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

export const NEWS_URL = 'https://news.spec.test/api/latest';
export const QUOTES_URL = 'https://quotes.spec.test/api/quote';
const UNREGISTERED_URL = 'https://unregistered.spec.test/thing';

/** Minimal Hono-compatible app — every route fans out to the network. */
const outboundApp = {
    request: async (path: string): Promise<Response> => {
        switch (path) {
            case '/combo': {
                // Two different providers in one request.
                const quoteResponse = await fetch(QUOTES_URL);
                const quote = await quoteResponse.json();
                const newsResponse = await fetch(NEWS_URL);
                const news = await newsResponse.json();
                return Response.json({ news, quote });
            }
            case '/health': {
                // No outgoing call at all.
                return Response.json({ ok: true });
            }
            case '/other': {
                // A call nobody declared an intercept for.
                const response = await fetch(UNREGISTERED_URL);
                return Response.json({ status: response.status }, { status: response.status });
            }
            case '/quote': {
                // One call, with a single retry on 429.
                let response = await fetch(QUOTES_URL);
                if (response.status === 429) {
                    response = await fetch(QUOTES_URL);
                }
                return Response.json(await response.json(), { status: response.status });
            }
            case '/submit': {
                // A POST that carries a JSON body, a custom header, and a
                // Query string — the surface an http trigger filter narrows on.
                const response = await fetch(`${QUOTES_URL}?lang=en`, {
                    body: JSON.stringify({ action: 'quote', user: { role: 'admin' } }),
                    headers: { 'content-type': 'application/json', 'x-tenant': 'acme' },
                    method: 'POST',
                });
                return Response.json(await response.json(), { status: response.status });
            }
            case '/quote-twice': {
                // Two calls to the same provider — exhausts a one-entry queue.
                const first = await fetch(QUOTES_URL);
                const second = await fetch(QUOTES_URL);
                return Response.json({ first: first.status, second: second.status });
            }
            default: {
                return Response.json({ error: 'not found' }, { status: 404 });
            }
        }
    },
};

export const { api, cleanup } = await specification.api({
    server: () => outboundApp,
});

afterAll(cleanup);
