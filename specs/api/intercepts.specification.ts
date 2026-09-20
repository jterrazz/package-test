/**
 * Runner for the strict-intercept specs (CONVENTIONS D7). Intercepts are
 * in-process (MSW), so the app under test runs in this process.
 *
 * The app under test is a tiny in-file Hono-compatible app whose only job
 * is to make outgoing HTTP calls — the surface the intercepts guard.
 */
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

export const NEWS_URL = 'https://news.spec.test/api/latest';
export const QUOTES_URL = 'https://quotes.spec.test/api/quote';
export const STREAM_URL = 'https://tokens.spec.test/api/stream';
const UNREGISTERED_URL = 'https://unregistered.spec.test/thing';

/** Every piece a streamed reply was written in, in the order it arrived. */
async function readChunks(response: Response, decoder: TextDecoder): Promise<string[]> {
    const stream = response.body;
    if (stream === null) {
        throw new Error('the provider answered with no body to read');
    }
    return await Array.fromAsync(stream, (piece: Uint8Array) => decoder.decode(piece));
}

/**
 * The routes, one per shape of outgoing traffic a contract has to answer.
 *
 * A record rather than a switch: each entry is read on its own, and adding the
 * next shape of call costs one key instead of one more branch of a function
 * nobody can hold in their head.
 */
const routes: Record<string, () => Promise<Response>> = {
    '/cancel': async () => {
        // The subject drops the body it did not need — what an SDK client does
        // Before a retry, and the one shape msw's node interceptor never
        // Settles (specs/api/intercepts/body-cancel.spec.ts).
        const response = await fetch(QUOTES_URL);
        await response.body?.cancel();
        return Response.json({ status: response.status });
    },
    '/combo': async () => {
        // Two different providers in one request.
        const quoteResponse = await fetch(QUOTES_URL);
        const quote = await quoteResponse.json();
        const newsResponse = await fetch(NEWS_URL);
        const news = await newsResponse.json();
        return Response.json({ news, quote });
    },
    '/health': async () =>
        // No outgoing call at all.
        await Promise.resolve(Response.json({ ok: true })),
    '/offline': async () => {
        // The transport failing is a different branch from a status:
        // `fetch` REJECTS, and nothing about the reply can be read.
        try {
            const response = await fetch(QUOTES_URL);
            return Response.json(await response.json(), { status: response.status });
        } catch {
            return Response.json({ error: 'the quotes service did not answer' }, { status: 503 });
        }
    },
    '/other': async () => {
        // A call nobody declared an intercept for.
        const response = await fetch(UNREGISTERED_URL);
        return Response.json({ status: response.status }, { status: response.status });
    },
    '/quote': async () => {
        // One call, with a single retry on 429.
        let response = await fetch(QUOTES_URL);
        if (response.status === 429) {
            response = await fetch(QUOTES_URL);
        }
        return Response.json(await response.json(), { status: response.status });
    },
    '/quote-twice': async () => {
        // Two calls to the same provider — exhausts a one-entry queue.
        const first = await fetch(QUOTES_URL);
        const second = await fetch(QUOTES_URL);
        return Response.json({ first: first.status, second: second.status });
    },
    '/submit': async () => {
        // A POST that carries a JSON body, a custom header, and a query
        // String — the surface an http trigger filter narrows on.
        const response = await fetch(`${QUOTES_URL}?lang=en`, {
            body: JSON.stringify({ action: 'quote', user: { role: 'admin' } }),
            headers: { 'content-type': 'application/json', 'x-tenant': 'acme' },
            method: 'POST',
        });
        return Response.json(await response.json(), { status: response.status });
    },
    '/tokens': async () => {
        // A provider that answers in PIECES: the app reads them as they land,
        // Which is the whole of what a stream contract states — the chunks and
        // Their order.
        const response = await fetch(STREAM_URL);
        const decoder = new TextDecoder();
        const chunks = await readChunks(response, decoder);
        return Response.json({ chunks, contentType: response.headers.get('content-type') });
    },
};

/** Minimal Hono-compatible app — every route fans out to the network. */
const outboundApp = {
    request: async (path: string): Promise<Response> => {
        const route = routes[path];
        if (route === undefined) {
            return Response.json({ error: 'not found' }, { status: 404 });
        }
        return await route();
    },
};

export const { api, cleanup } = await specification.api({
    server: () => outboundApp,
});

afterAll(cleanup);
